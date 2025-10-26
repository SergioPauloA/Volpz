// =============================================================================
// VOLPZ - Sistema de Comunicação Corporativa
// =============================================================================

// Estado da aplicação
const appState = {
    currentUser: null,
    websocket: null,
    currentConversation: null,
    conversations: new Map(),
    groups: new Map(),
    users: new Map(),
    activeTab: 'conversations'
}

// Elementos DOM - Login
const loginContainer = document.querySelector('.login-container')
const loginForm = document.querySelector('.login__form')
const cpfInput = document.getElementById('cpf')
const senhaInput = document.getElementById('senha')
const loginError = document.querySelector('.login-error')

// Elementos DOM - Interface Principal
const mainContainer = document.querySelector('.main-container')
const sidebarUserName = document.querySelector('.user-name')
const sidebarUserSector = document.querySelector('.user-sector')

// Elementos DOM - Navegação
const navButtons = document.querySelectorAll('.nav-button')
const tabContents = document.querySelectorAll('.tab-content')
const logoutButton = document.querySelector('.logout-button')

// Elementos DOM - Usuários
const usersContainer = document.querySelector('.users-container')

// Elementos DOM - Conversas
const conversationsContainer = document.querySelector('.conversations-container')

// Elementos DOM - Grupos
const groupsContainer = document.querySelector('.groups-container')
const createGroupButton = document.querySelector('.create-group-button')
const createGroupModal = document.getElementById('create-group-modal')
const groupForm = document.querySelector('.group-form')
const participantsList = document.querySelector('.participants-list')

// Elementos DOM - Administração
const registerForm = document.querySelector('.register-form')
const registerMessage = document.querySelector('.register-message')

// Elementos DOM - Chat
const chatArea = document.querySelector('.chat-area')
const chatHeader = document.querySelector('.chat-header')
const chatTitle = document.querySelector('.chat-title')
const chatSubtitle = document.querySelector('.chat-subtitle')
const chatMessages = document.querySelector('.chat-messages')
const chatForm = document.querySelector('.chat-form')
const chatInput = document.querySelector('.chat-input')
const closeChatButton = document.querySelector('.close-chat')

// =============================================================================
// FORMATAÇÃO E VALIDAÇÃO
// =============================================================================

function formatCPF(value) {
    const cleaned = value.replace(/\D/g, '')
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/)
    if (match) {
        return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`
    }
    return value
}

function validateCPF(cpf) {
    const cleaned = cpf.replace(/\D/g, '')
    return cleaned.length === 11
}

// =============================================================================
// CONEXÃO WEBSOCKET
// =============================================================================

function connectWebSocket() {
    try {
        appState.websocket = new WebSocket('ws://localhost:8080')
        
        appState.websocket.onopen = () => {
            console.log('Conectado ao servidor Volpz')
        }
        
        appState.websocket.onmessage = handleWebSocketMessage
        
        appState.websocket.onclose = () => {
            console.log('Conexão perdida. Tentando reconectar...')
            setTimeout(connectWebSocket, 3000)
        }
        
        appState.websocket.onerror = (error) => {
            console.error('Erro na conexão:', error)
        }
    } catch (error) {
        console.error('Erro ao conectar:', error)
    }
}

function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
            case 'loginSuccess':
                handleLoginSuccess(data.data)
                break
            case 'loginError':
                handleLoginError(data.data)
                break
            case 'registerSuccess':
                handleRegisterSuccess(data.data)
                break
            case 'registerError':
                handleRegisterError(data.data)
                break
            case 'usersList':
                handleUsersList(data.data)
                break
            case 'conversationStarted':
                handleConversationStarted(data.data)
                break
            case 'newMessage':
                handleNewMessage(data.data)
                break
            case 'groupCreated':
                handleGroupCreated(data.data)
                break
            case 'groupJoined':
                handleGroupJoined(data.data)
                break
            default:
                console.log('Mensagem não reconhecida:', data)
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error)
    }
}

// =============================================================================
// AUTENTICAÇÃO
// =============================================================================

function handleLogin(event) {
    event.preventDefault()
    
    const cpf = cpfInput.value.replace(/\D/g, '')
    const senha = senhaInput.value
    
    if (!validateCPF(cpfInput.value)) {
        showLoginError('CPF inválido')
        return
    }
    
    if (!senha) {
        showLoginError('Senha é obrigatória')
        return
    }
    
    hideLoginError()
    
    if (!appState.websocket || appState.websocket.readyState !== WebSocket.OPEN) {
        connectWebSocket()
        setTimeout(() => {
            sendMessage('login', { cpf, senha })
        }, 1000)
    } else {
        sendMessage('login', { cpf, senha })
    }
}

function handleLoginSuccess(data) {
    appState.currentUser = data.user
    loginContainer.style.display = 'none'
    mainContainer.style.display = 'flex'
    
    // Atualizar informações do usuário na sidebar
    sidebarUserName.textContent = appState.currentUser.nome
    sidebarUserSector.textContent = `${appState.currentUser.setor} - ${appState.currentUser.cargo || ''}`
    
    // Mostrar aba admin se for usuário T.I
    if (appState.currentUser.setor === 'T.I') {
        document.querySelector('[data-tab="admin"]').style.display = 'flex'
    }
    
    // Carregar dados iniciais
    loadUsers()
    loadConversations()
    loadGroups()
}

function handleLoginError(data) {
    showLoginError(data.message)
}

function showLoginError(message) {
    loginError.textContent = message
    loginError.style.display = 'block'
}

function hideLoginError() {
    loginError.style.display = 'none'
}

function handleLogout() {
    if (appState.websocket) {
        appState.websocket.close()
    }
    
    // Resetar estado
    appState.currentUser = null
    appState.websocket = null
    appState.currentConversation = null
    appState.conversations.clear()
    appState.groups.clear()
    appState.users.clear()
    
    // Resetar interface
    loginContainer.style.display = 'flex'
    mainContainer.style.display = 'none'
    chatArea.style.display = 'none'
    
    // Limpar formulários
    cpfInput.value = ''
    senhaInput.value = ''
    hideLoginError()
}

// =============================================================================
// NAVEGAÇÃO
// =============================================================================

function switchTab(tabName) {
    // Atualizar botões de navegação
    navButtons.forEach(btn => {
        btn.classList.remove('active')
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active')
        }
    })
    
    // Atualizar conteúdo das abas
    tabContents.forEach(content => {
        content.classList.remove('active')
        if (content.id === tabName + '-tab') {
            content.classList.add('active')
        }
    })
    
    appState.activeTab = tabName
    
    // Fechar chat se estiver aberto
    if (tabName !== 'conversations') {
        chatArea.style.display = 'none'
    }
    
    // Carregar dados específicos da aba
    switch (tabName) {
        case 'users':
            loadUsers()
            break
        case 'groups':
            loadGroups()
            break
    }
}

// =============================================================================
// GERENCIAMENTO DE USUÁRIOS
// =============================================================================

function loadUsers() {
    sendMessage('getUsers', {})
}

function handleUsersList(users) {
    appState.users.clear()
    users.forEach(user => {
        appState.users.set(user.cpf, user)
    })
    renderUsers()
}

function renderUsers() {
    const users = Array.from(appState.users.values())
    
    if (users.length === 0) {
        usersContainer.innerHTML = '<div class="no-conversations"><p>Nenhum usuário encontrado</p></div>'
        return
    }
    
    usersContainer.innerHTML = users.map(user => `
        <div class="user-card" onclick="startConversation('${user.cpf}')">
            <div class="user-card-header">
                <div class="user-name-large">${user.nome}</div>
                <div class="user-sector-badge">${user.setor}</div>
            </div>
            <div class="user-status">
                <div class="status-indicator ${user.online ? 'online' : ''}"></div>
                <span class="status-text">${user.online ? 'Online' : 'Offline'}</span>
            </div>
            ${user.cargo ? `<div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.5rem;">${user.cargo}</div>` : ''}
        </div>
    `).join('')
}

function startConversation(targetCpf) {
    sendMessage('startConversation', { targetCpf })
}

function handleConversationStarted(data) {
    const { conversationId, targetUser, messages } = data
    
    // Armazenar conversa
    appState.conversations.set(conversationId, {
        id: conversationId,
        targetUser,
        messages,
        isGroup: false
    })
    
    // Abrir chat
    openChat(conversationId, targetUser.nome, `${targetUser.setor} - ${targetUser.cargo || ''}`)
    
    // Renderizar mensagens
    renderMessages(messages)
    
    // Atualizar lista de conversas
    renderConversations()
    
    // Ir para aba de conversas se não estiver nela
    if (appState.activeTab !== 'conversations') {
        switchTab('conversations')
    }
}

// =============================================================================
// GERENCIAMENTO DE CONVERSAS
// =============================================================================

function loadConversations() {
    renderConversations()
}

function renderConversations() {
    const conversations = Array.from(appState.conversations.values())
    const groups = Array.from(appState.groups.values())
    const allChats = [...conversations, ...groups]
    
    if (allChats.length === 0) {
        conversationsContainer.innerHTML = `
            <div class="no-conversations">
                <p>Nenhuma conversa iniciada</p>
                <p>Vá para a aba "Usuários" para iniciar uma conversa</p>
            </div>
        `
        return
    }
    
    conversationsContainer.innerHTML = allChats.map(chat => {
        const isGroup = chat.isGroup || chat.participants
        const name = isGroup ? chat.name : chat.targetUser.nome
        const subtitle = isGroup 
            ? `${chat.participants ? chat.participants.length : 0} participantes`
            : chat.targetUser.setor
        const lastMessage = chat.messages && chat.messages.length > 0 
            ? chat.messages[chat.messages.length - 1] 
            : null
        
        return `
            <div class="conversation-item" onclick="openConversation('${chat.id}', ${isGroup})">
                <div class="conversation-info">
                    <div class="conversation-name">${name}</div>
                    <div class="conversation-preview">
                        ${lastMessage ? lastMessage.content : subtitle}
                    </div>
                </div>
            </div>
        `
    }).join('')
}

function openConversation(chatId, isGroup = false) {
    if (isGroup) {
        const group = appState.groups.get(chatId)
        if (group) {
            openChat(chatId, group.name, `${group.participants.length} participantes`, true)
            renderMessages(group.messages)
        }
    } else {
        const conversation = appState.conversations.get(chatId)
        if (conversation) {
            openChat(chatId, conversation.targetUser.nome, `${conversation.targetUser.setor} - ${conversation.targetUser.cargo || ''}`)
            renderMessages(conversation.messages)
        }
    }
}

// =============================================================================
// INTERFACE DE CHAT
// =============================================================================

function openChat(chatId, title, subtitle, isGroup = false) {
    appState.currentConversation = { id: chatId, isGroup }
    
    chatTitle.textContent = title
    chatSubtitle.textContent = subtitle
    chatArea.style.display = 'flex'
    
    // Limpar input
    chatInput.value = ''
    chatInput.focus()
}

function closeChat() {
    appState.currentConversation = null
    chatArea.style.display = 'none'
    chatMessages.innerHTML = ''
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 2rem;">Nenhuma mensagem ainda</div>'
        return
    }
    
    chatMessages.innerHTML = messages.map(message => {
        const isOwn = message.sender.cpf === appState.currentUser.cpf
        
        return `
            <div class="message ${isOwn ? 'message--self' : 'message--other'}">
                ${!isOwn ? `<span class="message-sender">${message.sender.nome}</span>` : ''}
                ${message.content}
            </div>
        `
    }).join('')
    
    // Scroll para última mensagem
    chatMessages.scrollTop = chatMessages.scrollHeight
}

function sendChatMessage(event) {
    event.preventDefault()
    
    if (!appState.currentConversation || !chatInput.value.trim()) {
        return
    }
    
    const content = chatInput.value.trim()
    
    sendMessage('sendMessage', {
        conversationId: appState.currentConversation.id,
        content,
        isGroup: appState.currentConversation.isGroup
    })
    
    chatInput.value = ''
}

function handleNewMessage(data) {
    const { conversationId, message, isGroup } = data
    
    // Adicionar mensagem à conversa/grupo correspondente
    if (isGroup && appState.groups.has(conversationId)) {
        const group = appState.groups.get(conversationId)
        group.messages.push(message)
        
        // Se estiver visualizando este grupo, atualizar mensagens
        if (appState.currentConversation && appState.currentConversation.id === conversationId) {
            renderMessages(group.messages)
        }
    } else if (!isGroup && appState.conversations.has(conversationId)) {
        const conversation = appState.conversations.get(conversationId)
        conversation.messages.push(message)
        
        // Se estiver visualizando esta conversa, atualizar mensagens
        if (appState.currentConversation && appState.currentConversation.id === conversationId) {
            renderMessages(conversation.messages)
        }
    }
    
    // Atualizar lista de conversas
    renderConversations()
}

// =============================================================================
// GERENCIAMENTO DE GRUPOS
// =============================================================================

function loadGroups() {
    renderGroups()
}

function renderGroups() {
    const groups = Array.from(appState.groups.values())
    
    if (groups.length === 0) {
        groupsContainer.innerHTML = `
            <div class="no-groups">
                <p>Nenhum grupo criado</p>
            </div>
        `
        return
    }
    
    groupsContainer.innerHTML = groups.map(group => `
        <div class="group-item" onclick="openConversation('${group.id}', true)">
            <div class="group-info">
                <div class="group-name">${group.name}</div>
                <div class="group-members">${group.participants.length} participantes</div>
            </div>
        </div>
    `).join('')
}

function openCreateGroupModal() {
    // Carregar lista de usuários para seleção
    const users = Array.from(appState.users.values())
    
    participantsList.innerHTML = users.map(user => `
        <div class="participant-item">
            <input type="checkbox" class="participant-checkbox" value="${user.cpf}" id="user-${user.cpf}">
            <label for="user-${user.cpf}" style="flex: 1; cursor: pointer;">
                <div style="font-weight: 500;">${user.nome}</div>
                <div style="font-size: 0.8rem; color: var(--text-light);">${user.setor}</div>
            </label>
        </div>
    `).join('')
    
    createGroupModal.style.display = 'flex'
}

function closeCreateGroupModal() {
    createGroupModal.style.display = 'none'
    groupForm.reset()
}

function handleCreateGroup(event) {
    event.preventDefault()
    
    const groupName = document.getElementById('group-name').value.trim()
    const selectedParticipants = Array.from(document.querySelectorAll('.participant-checkbox:checked'))
        .map(checkbox => checkbox.value)
    
    if (!groupName) {
        alert('Nome do grupo é obrigatório')
        return
    }
    
    if (selectedParticipants.length === 0) {
        alert('Selecione pelo menos um participante')
        return
    }
    
    sendMessage('createGroup', {
        groupName,
        participants: selectedParticipants
    })
    
    closeCreateGroupModal()
}

function handleGroupCreated(data) {
    const { group } = data
    
    // Adicionar grupo ao estado
    appState.groups.set(group.id, {
        id: group.id,
        name: group.name,
        participants: group.participants,
        messages: [],
        isGroup: true
    })
    
    // Renderizar grupos
    renderGroups()
    renderConversations()
}

function handleGroupJoined(data) {
    const { groupId, groupName, messages, participants } = data
    
    // Adicionar grupo ao estado
    appState.groups.set(groupId, {
        id: groupId,
        name: groupName,
        participants,
        messages,
        isGroup: true
    })
    
    renderGroups()
    renderConversations()
}

// =============================================================================
// ADMINISTRAÇÃO
// =============================================================================

function handleRegister(event) {
    event.preventDefault()
    
    const cpf = document.getElementById('new-cpf').value.replace(/\D/g, '')
    const senha = document.getElementById('new-senha').value
    const nome = document.getElementById('new-nome').value.trim()
    const setor = document.getElementById('new-setor').value
    const cargo = document.getElementById('new-cargo').value.trim()
    
    if (!validateCPF(document.getElementById('new-cpf').value)) {
        showRegisterMessage('CPF inválido', 'error')
        return
    }
    
    if (!senha || !nome || !setor || !cargo) {
        showRegisterMessage('Todos os campos são obrigatórios', 'error')
        return
    }
    
    sendMessage('register', { cpf, senha, nome, setor, cargo })
}

function handleRegisterSuccess(data) {
    showRegisterMessage(data.message, 'success')
    registerForm.reset()
    
    // Recarregar lista de usuários
    setTimeout(() => {
        loadUsers()
    }, 1000)
}

function handleRegisterError(data) {
    showRegisterMessage(data.message, 'error')
}

function showRegisterMessage(message, type) {
    registerMessage.textContent = message
    registerMessage.className = `register-message ${type}`
    registerMessage.style.display = 'block'
    
    setTimeout(() => {
        registerMessage.style.display = 'none'
    }, 5000)
}

// =============================================================================
// UTILITÁRIOS
// =============================================================================

function sendMessage(type, data) {
    if (appState.websocket && appState.websocket.readyState === WebSocket.OPEN) {
        appState.websocket.send(JSON.stringify({ type, data }))
    } else {
        console.error('WebSocket não conectado')
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Formatação automática de CPF
cpfInput.addEventListener('input', (e) => {
    e.target.value = formatCPF(e.target.value)
})

document.getElementById('new-cpf').addEventListener('input', (e) => {
    e.target.value = formatCPF(e.target.value)
})

// Formulários
loginForm.addEventListener('submit', handleLogin)
chatForm.addEventListener('submit', sendChatMessage)
registerForm.addEventListener('submit', handleRegister)
groupForm.addEventListener('submit', handleCreateGroup)

// Navegação
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        switchTab(button.dataset.tab)
    })
})

// Botões
logoutButton.addEventListener('click', handleLogout)
closeChatButton.addEventListener('click', closeChat)
createGroupButton.addEventListener('click', openCreateGroupModal)

// Modal
document.querySelector('.close-modal').addEventListener('click', closeCreateGroupModal)
document.querySelector('.cancel-button').addEventListener('click', closeCreateGroupModal)

// Fechar modal clicando fora
createGroupModal.addEventListener('click', (e) => {
    if (e.target === createGroupModal) {
        closeCreateGroupModal()
    }
})

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================

// Conectar WebSocket ao carregar a página
connectWebSocket()

console.log('🚀 Volpz - Sistema de Comunicação Corporativa carregado!')
