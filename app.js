import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

/**
 * ==========================================
 * CONFIGURAÇÃO DO FIREBASE (COLE AQUI)
 * ==========================================
 */
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD9rRmZqNS2xDTBZ_kEt3_Wyf38n_cGEX8",
    authDomain: "senhas-app-ed83e.firebaseapp.com",
    projectId: "senhas-app-ed83e",
    storageBucket: "senhas-app-ed83e.firebasestorage.app",
    messagingSenderId: "142305769065",
    appId: "1:142305769065:web:1ecb589c4d3ad1d5a814f8",
    measurementId: "G-M2BZ3MCC22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * ==========================================
 * ESTADO DA APLICAÇÃO
 * ==========================================
 */
let localPasswords = [];

// DOM Elements
const btnLogin = document.getElementById('btn-login');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const btnLogout = document.getElementById('btn-logout');

const mainView = document.getElementById('main-view');

const toggleFormBtn = document.getElementById('toggle-form-btn');
const passwordForm = document.getElementById('password-form');
const btnAddPassword = document.getElementById('btn-add-password');
const btnGenerate = document.getElementById('btn-generate');

const inputCliente = document.getElementById('cliente');
const inputPedido = document.getElementById('pedido');
const inputSerie = document.getElementById('serie');
const inputSenha = document.getElementById('senha');

const passwordListContainer = document.getElementById('password-list');
const emptyState = document.getElementById('empty-state');
const loadingSpinner = document.getElementById('loading-spinner');
const passwordCount = document.getElementById('password-count');
const searchInput = document.getElementById('search-input');

const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');

/**
 * ==========================================
 * AUTENTICAÇÃO
 * ==========================================
 */

let unsubscribe = null; // Para parar de escutar o Firestore quando deslogar

// Monitora o estado de login
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário logado
        btnLogin.style.display = 'none';
        userProfile.style.display = 'flex';
        userAvatar.src = user.photoURL || 'https://ui-avatars.com/api/?name=User&background=bb86fc&color=fff';
        mainView.classList.remove('hidden');

        // Inicia a escuta dos dados em tempo real
        loadDataFromFirestore(user.uid);
    } else {
        // Usuário deslogado
        btnLogin.style.display = 'inline-flex';
        userProfile.style.display = 'none';
        mainView.classList.add('hidden');
        passwordListContainer.innerHTML = '';
        localPasswords = [];

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    }
});

// Adicionar feedback visual ao carregar o estado
let isLoggingIn = false;

btnLogin.onclick = async () => {
    if (isLoggingIn) return;

    isLoggingIn = true;
    const originalText = btnLogin.innerHTML;
    btnLogin.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">autorenew</span> Aguarde...';

    const provider = new GoogleAuthProvider();
    // Em alguns celulares o Custom Tab lidará com o Popup muito melhor do que o Redirect
    try {
        await signInWithPopup(auth, provider);
        // O onAuthStateChanged vai ser acionado sozinho
    } catch (error) {
        console.error("Erro ao iniciar login:", error);
        alert("Falha no login: " + error.message);
        btnLogin.innerHTML = originalText;
    } finally {
        isLoggingIn = false;
    }
};

btnLogout.onclick = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro no logout:", error);
    }
};

/**
 * ==========================================
 * GERENCIAMENTO DE DADOS (FIRESTORE)
 * ==========================================
 */

function loadDataFromFirestore(userId) {
    showLoading();

    // Query simples buscar senhas criadas por este usuário, ordenadas por data desc crescente
    const q = query(collection(db, "passwords"), orderBy("createdAt", "desc"));

    // onSnapshot atualiza em TEMPO REAL sempre que mudar no banco
    unsubscribe = onSnapshot(q, (snapshot) => {
        localPasswords = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Apenas para garantir que o usuário veja só os seus (Firestore Rules farão a segurança real)
            if (data.userId === userId || !data.userId) { // Adicionado fallback para registros antigos ou sem userId estritos
                localPasswords.push({
                    id: doc.id,
                    data: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                    cliente: data.cliente || '',
                    pedido: data.pedido || '',
                    serie: data.serie || '',
                    senha: data.senha || ''
                });
            }
        });
        // Apenas atualizar a interface se o campo de busca estiver ativo
        renderPasswords(searchInput.value);
        hideLoading();
    }, (error) => {
        console.error("Erro ao ler Firestore:", error);
        showToast('Falha ao sincronizar dados.', 'error');
        hideLoading();
    });
}

/**
 * ==========================================
 * UI E INTERAÇÕES MAIN VIEW
 * ==========================================
 */

toggleFormBtn.onclick = () => {
    const isCollapsed = toggleFormBtn.classList.contains('collapsed');
    if (isCollapsed) {
        toggleFormBtn.classList.remove('collapsed');
        passwordForm.classList.remove('hidden');
    } else {
        toggleFormBtn.classList.add('collapsed');
        passwordForm.classList.add('hidden');
    }
};

if (window.innerWidth < 600) {
    // toggleFormBtn.click();
    toggleFormBtn.classList.add('collapsed');
    passwordForm.classList.add('hidden');
}

const checkFormValid = () => {
    const c = inputCliente.value.trim();
    const p = inputPedido.value.trim();
    const s = inputSerie.value.trim();
    const pw = inputSenha.value.trim();

    if (c && p && s && pw.length === 4 && /^\d+$/.test(pw) && auth.currentUser) {
        btnAddPassword.removeAttribute('disabled');
    } else {
        btnAddPassword.setAttribute('disabled', 'true');
    }
};

[inputCliente, inputPedido, inputSerie, inputSenha].forEach(input => {
    input.addEventListener('input', checkFormValid);
});

inputSenha.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
});

btnGenerate.onclick = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString().padStart(4, '0');
    inputSenha.value = randomPin;
    checkFormValid();

    inputSenha.style.transform = 'scale(1.05)';
    setTimeout(() => {
        inputSenha.style.transform = 'scale(1)';
    }, 150);
};

passwordForm.onsubmit = async (e) => {
    e.preventDefault();
    if (btnAddPassword.disabled || !auth.currentUser) return;

    const cliente = inputCliente.value.trim();
    const pedido = inputPedido.value.trim();
    const serie = inputSerie.value.trim();
    const senha = inputSenha.value.trim();

    btnAddPassword.setAttribute('disabled', 'true');
    showSyncStatus('Salvando...', false);

    try {
        // Enviar para Firestore
        const userIdToSave = auth.currentUser ? auth.currentUser.uid : "anonymous";
        await addDoc(collection(db, "passwords"), {
            userId: userIdToSave,
            cliente,
            pedido,
            serie,
            senha,
            createdAt: serverTimestamp()
        });

        // Como usamos onSnapshot, a lista será atualizada automaticamente!
        // A interface, no entanto, só deve mostrar as senhas se a barra de pesquisa tiver algum texto nela.
        inputCliente.value = '';
        inputPedido.value = '';
        inputSerie.value = '';
        inputSenha.value = '';
        inputCliente.focus();
        checkFormValid();
        
        // Vamos ocultar imediatamente a lista caso a barra de busca esteja vazia
        // forçando a renderização inicial
        renderPasswords(searchInput.value);

        showToast('Senha salva com sucesso!', 'success');
        hideSyncStatus();

    } catch (error) {
        console.error("Erro ao salvar:", error);
        showSyncStatus('Erro ao salvar no Firebase.', true);
        setTimeout(hideSyncStatus, 3000);
        btnAddPassword.removeAttribute('disabled');
    }
};

async function deletePassword(passwordId) {
    if (!confirm("Tem certeza que deseja excluir esta senha?")) return;

    showSyncStatus('Excluindo...', false);
    try {
        await deleteDoc(doc(db, "passwords", passwordId));
        showToast('Senha excluída com sucesso!', 'success');
        hideSyncStatus();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        showSyncStatus('Erro ao excluir.', true);
        setTimeout(hideSyncStatus, 3000);
    }
}

function renderPasswords(filter = '') {
    passwordListContainer.innerHTML = '';

    const term = filter.trim().toLowerCase();
    
    // Se o termo de busca estiver vazio, não mostra nada
    if (!term) {
        passwordCount.textContent = '0';
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <span class="material-icons-round empty-icon">search</span>
            <h3>Busque suas senhas</h3>
            <p>Digite o nome do cliente, pedido ou série para visualizar.</p>
        `;
        return;
    }

    const filtered = localPasswords.filter(p => {
        return p.cliente.toLowerCase().includes(term) ||
            p.pedido.toLowerCase().includes(term) ||
            p.serie.toLowerCase().includes(term);
    });

    passwordCount.textContent = filtered.length;

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <span class="material-icons-round empty-icon">assignment_late</span>
            <h3>Nenhuma senha encontrada</h3>
            <p>Sua busca não retornou resultados.</p>
        `;
    } else {
        emptyState.classList.add('hidden');

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'pwd-card';

            const pwdHeader = document.createElement('div');
            pwdHeader.className = 'pwd-header';

            const clienteSpan = document.createElement('span');
            clienteSpan.className = 'pwd-cliente';
            clienteSpan.textContent = p.cliente;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'pwd-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-icon btn-copy';
            copyBtn.title = 'Copiar Senha';
            copyBtn.setAttribute('data-pwd', p.senha);
            copyBtn.innerHTML = '<span class="material-icons-round">content_copy</span>';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(p.senha).then(() => {
                    showToast('Senha copiada!', 'success');
                });
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon btn-delete';
            deleteBtn.title = 'Excluir Senha';
            deleteBtn.innerHTML = '<span class="material-icons-round">delete</span>';
            deleteBtn.style.color = 'var(--error)';
            deleteBtn.onclick = () => deletePassword(p.id);
            
            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(deleteBtn);
            pwdHeader.appendChild(clienteSpan);
            pwdHeader.appendChild(actionsDiv);

            const pwdDetails = document.createElement('div');
            pwdDetails.className = 'pwd-details';
            pwdDetails.innerHTML = `
                <div class="pwd-detail-item">
                    <span class="pwd-detail-label">Nº Pedido</span>
                    <span>${escapeHTML(p.pedido)}</span>
                </div>
                <div class="pwd-detail-item">
                    <span class="pwd-detail-label">Série</span>
                    <span>${escapeHTML(p.serie)}</span>
                </div>
                <div class="pwd-detail-item" style="margin-left:auto; text-align:right">
                    <span class="pwd-detail-label">${escapeHTML(p.data)}</span>
                </div>
            `;

            const pwdValueContainer = document.createElement('div');
            pwdValueContainer.className = 'pwd-value-container';
            pwdValueContainer.innerHTML = `<span class="pwd-value">${escapeHTML(p.senha)}</span>`;

            card.appendChild(pwdHeader);
            card.appendChild(pwdDetails);
            card.appendChild(pwdValueContainer);

            passwordListContainer.appendChild(card);
        });
    }
}

searchInput.addEventListener('input', (e) => {
    renderPasswords(e.target.value);
});

/**
 * ==========================================
 * HELPERS
 * ==========================================
 */

function showLoading() {
    loadingSpinner.classList.remove('hidden');
    passwordListContainer.style.display = 'none';
    emptyState.classList.add('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
    passwordListContainer.style.display = 'flex';
}

function showSyncStatus(msg, isError) {
    statusText.textContent = msg;
    statusBar.className = `status-bar ${isError ? 'error' : ''}`;
    statusBar.classList.remove('hidden');
}

function hideSyncStatus() {
    statusBar.classList.add('hidden');
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Ícones do material icon round
    const iconName = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-icons-round">${iconName}</span> ${escapeHTML(msg)}`;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/**
 * ==========================================
 * PWA
 * ==========================================
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('ServiceWorker registrado', reg.scope))
            .catch(err => console.log('Erro no ServiceWorker', err));
    });
}
