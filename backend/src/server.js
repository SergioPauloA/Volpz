const { WebSocketServer } = require("ws")
const dotenv = require("dotenv")

dotenv.config()

const wss = new WebSocketServer({ port: process.env.PORT || 8080 })

// Banco de dados em memória para usuários
const users = {
    "20030321778": {
        cpf: "20030321778",
        senha: "SergioP10",
        nome: "Sergio Paulo de Andrade",
        setor: "T.I",
        cargo: "Gestor de T.I"
    }
}

// Armazenar conexões ativas dos usuários
const activeConnections = new Map()

// Armazenar conversas e grupos
const conversations = new Map()
const groups = new Map()

wss.on("connection", (ws) => {
    ws.on("error", console.error)

    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString())
            
            switch (message.type) {
                case "login":
                    handleLogin(ws, message)
                    break
                case "register":
                    handleRegister(ws, message)
                    break
                case "getUsers":
                    handleGetUsers(ws, message)
                    break
                case "startConversation":
                    handleStartConversation(ws, message)
                    break
                case "sendMessage":
                    handleSendMessage(ws, message)
                    break
                case "createGroup":
                    handleCreateGroup(ws, message)
                    break
                case "joinGroup":
                    handleJoinGroup(ws, message)
                    break
                default:
                    // Compatibilidade com chat antigo
                    wss.clients.forEach((client) => client.send(data.toString()))
            }
        } catch (error) {
            console.error("Erro ao processar mensagem:", error)
        }
    })

    ws.on("close", () => {
        // Remover conexão ativa quando usuário desconectar
        for (let [cpf, connection] of activeConnections) {
            if (connection === ws) {
                activeConnections.delete(cpf)
                console.log(`Usuário ${cpf} desconectado`)
                break
            }
        }
    })

    console.log("client connected")
})

// Funções de manipulação de mensagens
function handleLogin(ws, message) {
    const { cpf, senha } = message.data
    
    if (users[cpf] && users[cpf].senha === senha) {
        activeConnections.set(cpf, ws)
        ws.userCpf = cpf
        
        ws.send(JSON.stringify({
            type: "loginSuccess",
            data: {
                user: {
                    cpf: users[cpf].cpf,
                    nome: users[cpf].nome,
                    setor: users[cpf].setor,
                    cargo: users[cpf].cargo
                }
            }
        }))
        console.log(`Login realizado: ${users[cpf].nome}`)
    } else {
        ws.send(JSON.stringify({
            type: "loginError",
            data: { message: "CPF ou senha incorretos" }
        }))
    }
}

function handleRegister(ws, message) {
    const { cpf, senha, nome, setor, cargo } = message.data
    const userCpf = ws.userCpf
    
    // Verificar se usuário tem permissão (setor T.I)
    if (!userCpf || !users[userCpf] || users[userCpf].setor !== "T.I") {
        ws.send(JSON.stringify({
            type: "registerError",
            data: { message: "Acesso negado. Apenas usuários do setor T.I podem cadastrar novos usuários." }
        }))
        return
    }
    
    if (users[cpf]) {
        ws.send(JSON.stringify({
            type: "registerError",
            data: { message: "CPF já cadastrado" }
        }))
        return
    }
    
    users[cpf] = { cpf, senha, nome, setor, cargo }
    
    ws.send(JSON.stringify({
        type: "registerSuccess",
        data: { message: "Usuário cadastrado com sucesso" }
    }))
    
    console.log(`Novo usuário cadastrado: ${nome}`)
}

function handleGetUsers(ws, message) {
    const userCpf = ws.userCpf
    if (!userCpf || !users[userCpf]) return
    
    const usersList = Object.values(users)
        .filter(user => user.cpf !== userCpf)
        .map(user => ({
            cpf: user.cpf,
            nome: user.nome,
            setor: user.setor,
            cargo: user.cargo,
            online: activeConnections.has(user.cpf)
        }))
    
    ws.send(JSON.stringify({
        type: "usersList",
        data: usersList
    }))
}

function handleStartConversation(ws, message) {
    const { targetCpf } = message.data
    const userCpf = ws.userCpf
    
    if (!userCpf || !users[userCpf] || !users[targetCpf]) return
    
    const conversationId = [userCpf, targetCpf].sort().join("-")
    
    if (!conversations.has(conversationId)) {
        conversations.set(conversationId, {
            id: conversationId,
            participants: [userCpf, targetCpf],
            messages: []
        })
    }
    
    ws.send(JSON.stringify({
        type: "conversationStarted",
        data: {
            conversationId,
            targetUser: {
                cpf: users[targetCpf].cpf,
                nome: users[targetCpf].nome,
                setor: users[targetCpf].setor
            },
            messages: conversations.get(conversationId).messages
        }
    }))
}

function handleSendMessage(ws, message) {
    const { conversationId, content, isGroup = false } = message.data
    const userCpf = ws.userCpf
    
    if (!userCpf || !users[userCpf]) return
    
    const messageObj = {
        id: Date.now().toString(),
        sender: {
            cpf: userCpf,
            nome: users[userCpf].nome
        },
        content,
        timestamp: new Date().toISOString()
    }
    
    if (isGroup && groups.has(conversationId)) {
        const group = groups.get(conversationId)
        group.messages.push(messageObj)
        
        // Enviar para todos os participantes do grupo
        group.participants.forEach(participantCpf => {
            const connection = activeConnections.get(participantCpf)
            if (connection) {
                connection.send(JSON.stringify({
                    type: "newMessage",
                    data: {
                        conversationId,
                        message: messageObj,
                        isGroup: true
                    }
                }))
            }
        })
    } else if (conversations.has(conversationId)) {
        const conversation = conversations.get(conversationId)
        conversation.messages.push(messageObj)
        
        // Enviar para todos os participantes da conversa
        conversation.participants.forEach(participantCpf => {
            const connection = activeConnections.get(participantCpf)
            if (connection) {
                connection.send(JSON.stringify({
                    type: "newMessage",
                    data: {
                        conversationId,
                        message: messageObj,
                        isGroup: false
                    }
                }))
            }
        })
    }
}

function handleCreateGroup(ws, message) {
    const { groupName, participants } = message.data
    const userCpf = ws.userCpf
    
    if (!userCpf || !users[userCpf]) return
    
    const groupId = `group-${Date.now()}`
    const allParticipants = [userCpf, ...participants]
    
    groups.set(groupId, {
        id: groupId,
        name: groupName,
        creator: userCpf,
        participants: allParticipants,
        messages: [],
        createdAt: new Date().toISOString()
    })
    
    // Notificar todos os participantes sobre o novo grupo
    allParticipants.forEach(participantCpf => {
        const connection = activeConnections.get(participantCpf)
        if (connection) {
            connection.send(JSON.stringify({
                type: "groupCreated",
                data: {
                    group: {
                        id: groupId,
                        name: groupName,
                        participants: allParticipants.map(cpf => ({
                            cpf,
                            nome: users[cpf].nome
                        }))
                    }
                }
            }))
        }
    })
}

function handleJoinGroup(ws, message) {
    const { groupId } = message.data
    const userCpf = ws.userCpf
    
    if (!userCpf || !users[userCpf] || !groups.has(groupId)) return
    
    const group = groups.get(groupId)
    
    ws.send(JSON.stringify({
        type: "groupJoined",
        data: {
            groupId,
            groupName: group.name,
            messages: group.messages,
            participants: group.participants.map(cpf => ({
                cpf,
                nome: users[cpf].nome
            }))
        }
    }))
}
