const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();

// O Render exige que o servidor use a porta que ele definir via process.env.PORT
const PORT = process.env.PORT || 3000;

// Configurações Globais (Middlewares)
app.use(cors());
app.use(express.json());

// Inicializando a IA do Gemini com a chave de API das variáveis de ambiente
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// BANCO EM MEMÓRIA (Útil para testes rápidos de requisições no servidor)
let BANCO_DE_DADOS_MEMORIA = [];

// ==========================================
// ROTAS DO SISTEMA
// ==========================================

// Rota base para testar no navegador
app.get('/', (req, res) => {
    res.send('Servidor do StudyBuddy AI está online e voando!');
});

// RF01 - Cadastro de Usuário
app.post('/api/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Por favor, preencha todos os campos.' });
    }

    // Procura na variável global
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

        // Salva direto na memória
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

    // Busca na variável global
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

// RF06 e RF07 - Chat com Inteligência Artificial (Modelos e Fallback Corrigidos)
app.post('/api/chat', async (req, res) => {
    const textoUsuario = req.body.mensagem || req.body.message;

    if (!textoUsuario) {
        return res.status(400).json({ erro: 'A mensagem não pode estar vazia.' });
    }

    const prompt = `Você é o StudyBuddy AI, um assistente virtual focado em ajudar estudantes de forma didática e clara. Pergunta do aluno: ${textoUsuario}`;

    try {
        // 1. TENTA O MODELO PRINCIPAL (gemini-2.5-flash)
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
        });

        return res.status(200).json({ resposta: response.text });

    } catch (erro) {
        console.warn('Modelo principal (2.5-flash) indisponível ou em cota. Tentando o reserva (2.0-flash)...');

        try {
            // 2. TENTA O MODELO RESERVA VÁLIDO (gemini-2.0-flash)
            const responseBackup = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
            });

            return res.status(200).json({ resposta: responseBackup.text });

        } catch (erroBackup) {
            console.error('Erro em ambos os modelos do Gemini:', erroBackup.message || erroBackup);

            const msg = erroBackup.message || '';

            // Se for estouro de cota (429 / RESOURCE_EXHAUSTED)
            if (erroBackup.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
                return res.status(429).json({ 
                    erro: 'A API do Gemini atingiu o limite temporário de requisições gratuitas. Aguarde cerca de 1 minuto e tente novamente.' 
                });
            }

            return res.status(500).json({ 
                erro: 'Erro ao comunicar com a Inteligência Artificial. Tente novamente em instantes.' 
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor do StudyBuddy AI rodando na porta ${PORT}`);
});
