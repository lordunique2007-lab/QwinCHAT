const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware/auth');

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, context } = req.body;

    const systemPrompt = `You are QwinAI, the intelligent assistant built into QwinCHAT — a premium global messaging platform created by Qwin Grace. You are helpful, friendly, and concise. You can:
- Answer any questions users have
- Summarize conversations when provided
- Translate text to any language
- Provide smart reply suggestions
- Help with content moderation decisions
- Assist with platform navigation

Always respond as QwinAI, not as Claude. Keep responses concise and conversational.
${context ? `Context: ${context}` : ''}`;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.content[0].text;
    res.json({ reply });
  } catch (err) {
    console.error('QwinAI error:', err.response?.data || err.message);
    res.status(500).json({ error: 'QwinAI is unavailable right now' });
  }
});

// Summarize messages
router.post('/summarize', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    const messageText = messages.map(m => `${m.display_name}: ${m.content}`).join('\n');

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Please summarize this chat conversation in 3-5 bullet points:\n\n${messageText}`
      }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    res.json({ summary: response.data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

// Translate text
router.post('/translate', auth, async (req, res) => {
  try {
    const { text, target_language } = req.body;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Translate the following text to ${target_language}. Return ONLY the translation, nothing else:\n\n${text}`
      }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    res.json({ translation: response.data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Smart replies
router.post('/smart-reply', auth, async (req, res) => {
  try {
    const { last_message } = req.body;

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Generate 3 short, natural reply suggestions for this message. Return as JSON array of strings only:\n\n"${last_message}"`
      }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    let suggestions;
    try {
      const text = response.data.content[0].text;
      suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      suggestions = ['👍', 'Sounds good!', 'Got it!'];
    }

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Smart reply failed' });
  }
});

module.exports = router;
