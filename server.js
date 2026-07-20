const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();

// O Render exige que o servidor use a porta que ele definir via process.env.PORT
const PORT = process.env.PORT || 3000;

// Configurações Globais (Middlewares)
app.use(cors());
app.use(express.json());

// Inicializando a conexão com a Groq usando a biblioteca da OpenAI
const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1" 
});

// BANCO DE DADOS EM MEMÓRIA
let BANCO_DE_DADOS_MEMORIA = [];

// ==========================================
// ROTAS DO SISTEMA
// ==========================================

// Rota base para testar no navegador
app.get('/', (req, res) => {
    res.send('Servidor do StudyBuddy AI está online e rodando com a Groq!');
});

// RF01 - Cadastro de Usuário
app.post('/api/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Por favor, preencha todos os campos.' });
    }

    const usuarioExiste = BANCO_DE_DADOS_MEMORIA.find(u => u.email === email);
    if (usuarioExiste) {
        return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const senhaCriptografada = await bcrypt.hash(senha, salt);

        const novoUsuario = {
            id: Date.now().toString(),
            nome,
            email,
            senha: senhaCriptografada
        };

        BANCO_DE_DADOS_MEMORIA.push(novoUsuario);
        res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar o cadastro.' });
    }
});

// RF02 - Login Seguro
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Por favor, preencha e-mail e senha.' });
    }

    const usuario = BANCO_DE_DADOS_MEMORIA.find(u => u.email === email);
    if (!usuario) {
        return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    try {
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
        }

        res.status(200).json({
            mensagem: 'Login realizado com sucesso!',
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar o login.' });
    }
});

// RF06 e RF07 - Chat com IA (Usando Groq Llama 3.1)
app.post('/api/chat', async (req, res) => {
    const textoUsuario = req.body.mensagem || req.body.message;

    if (!textoUsuario) {
        return res.status(400).json({ erro: 'A mensagem não pode estar vazia.' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'llama-3.1-8b-instant', // ✅ Modelo novo e suportado pela Groq
            messages: [
                {
                    role: 'system',
                    content: 'Você é o StudyBuddy AI, um assistente virtual focado em ajudar estudantes de forma didática e clara.'
                },
                {
                    role: 'user',
                    content: textoUsuario
                }
            ],
            temperature: 0.7,
        });

        const respostaTexto = response.choices[0].message.content;
        return res.status(200).json({ resposta: respostaTexto });

    } catch (erro) {
        console.error('Erro na API da Groq:', erro);
        return res.status(500).json({ 
            erro: 'Erro ao comunicar com a Inteligência Artificial. Tente novamente em instantes.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor do StudyBuddy AI rodando na porta ${PORT}`);
});
