const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();

// ✅ CORRIGIDO: O Render exige que o servidor use a porta que ele definir via process.env.PORT
const PORT = process.env.PORT || 3000;

// Configurações Globais (Middlewares)
app.use(cors());
app.use(express.json());

// Inicializando a IA com a chave salva no seu arquivo .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FILE_PATH = path.join(__dirname, 'usuarios.json');

const lerUsuarios = () => {
    if (!fs.existsSync(FILE_PATH)) {
        // ✅ CORRIGIDO: Garante que o arquivo exista na nuvem se ele sumir ao reiniciar o container
        fs.writeFileSync(FILE_PATH, '[]');
        return [];
    }
    const dados = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(dados || '[]');
};

const salvarUsuarios = (usuarios) => {
    fs.writeFileSync(FILE_PATH, JSON.stringify(usuarios, null, 2));
};

// ==========================================
// ROTAS DO SISTEMA
// ==========================================

// Rota base para testar no navegador
app.get('/', (req, res) => {
    res.send('Servidor do StudyBuddy AI está online!');
});

// RF01 - Cadastro de Usuário
app.post('/api/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Por favor, preencha todos os campos.' });
    }

    const usuarios = lerUsuarios();
    const usuarioExiste = usuarios.find(u => u.email === email);
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

        usuarios.push(novoUsuario);
        salvarUsuarios(usuarios);

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

    const usuarios = lerUsuarios();
    const usuario = usuarios.find(u => u.email === email);
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

// RF06 e RF07 - Chat com Inteligência Artificial
app.post('/api/chat', async (req, res) => {
    const textoUsuario = req.body.mensagem || req.body.message;

    if (!textoUsuario) {
        return res.status(400).json({ erro: 'A mensagem não pode estar vazia.' });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: `Você é o StudyBuddy AI, um assistente virtual focado em ajudar estudantes de forma didática e clara. Pergunta do aluno: ${textoUsuario}`,
        });

        res.status(200).json({ resposta: response.text });
    } catch (erro) {
        console.error('Erro detalhado no Gemini:', erro);
        res.status(500).json({ erro: 'Erro na Inteligência Artificial. Verifique o terminal do servidor.' });
    }
});

// ✅ ALTERADO: Escutando na porta dinâmica do ambiente ou 3000 localmente
app.listen(PORT, () => {
    console.log(`Servidor do StudyBuddy AI rodando na porta ${PORT}`);
});
