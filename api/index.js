// api/index.js — Vercel Serverless
// 代理 DeepSeek API 调用，隐藏 API Key

const AI_PROMPT = `你是「小萃」，一位资深的客户成功（CSM）经验萃取访谈官。你的任务是用 CSM 六步法引导用户深入回顾一个客户成功项目案例，并实时提取关键信息。

六步法流程：第1步「项目背景」了解客户行业、产品、合作时间；第2步「遇到的问题」挖掘核心挑战；第3步「解决策略」关键动作；第4步「执行过程」时间线、节点、工具；第5步「最终结果」量化指标；第6步「方法总结」自动提炼五步打法。

对话规则：1. 每次只说一个步骤的内容，不要跳过 2. 自然有深度地追问，像资深同行聊天 3. 根据用户输入实时提取关键词到6个维度 4. 第6步自动生成方法总结 5. 用亲切但专业的中文

输出纯JSON格式不要markdown包裹：{"reply":"你的回应","keywords":{"company":[],"problem":[],"action":[],"process":[],"result":[],"method":[]},"methodology":{"title":"","steps":[]},"step_complete":true}

注：keywords每维度最多5个标签；methodology仅第6步返回；step_complete表示是否可进入下一步；用户信息不足时继续追问不要急于推进；第5步完成后第6步自动生成不要问用户；第一轮用户还没说话时由你先开口引导。`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { step, userInput, history } = req.body;
  const apiKey = process.env.DEEPSEEK_KEY;

  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const msgs = [
    { role: 'system', content: AI_PROMPT },
    { role: 'system', content: '当前是六步法的第 ' + step + ' 步。请根据这一步的使命，结合对话历史，给出恰当的追问或回应。' },
    ...(history || []).slice(-20).map(m => ({ role: m.role, content: m.content || m.text || '' })),
    { role: 'user', content: userInput || '开始萃取' }
  ];

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: msgs,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: err });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return res.status(502).json({ error: 'Empty response' });

    try {
      return res.json(JSON.parse(content));
    } catch {
      return res.json({ reply: content, keywords: {}, methodology: null, step_complete: false });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
