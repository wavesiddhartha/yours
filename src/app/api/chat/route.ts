import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const MINIMAX_KEY = "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";
const NEMOTRON_KEY = "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";
const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Helper to format messages based on whether the model is multimodal
function formatMessages(messages: any[], isMultimodal: boolean) {
  return messages.map((m: any) => {
    // If there are images and target model supports them
    if (m.images && m.images.length > 0 && isMultimodal) {
      const contentParts: any[] = [];
      if (m.content) {
        contentParts.push({ type: 'text', text: m.content });
      }
      m.images.forEach((img: any) => {
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl }
        });
      });
      return { role: m.role, content: contentParts };
    }

    // Text-only model or no images
    // If it's a text-only model but message has images, prepend text note
    if (m.images && m.images.length > 0 && !isMultimodal) {
      const note = `[Visual Attachment: ${m.images.map((i: any) => i.name).join(', ')}]`;
      return {
        role: m.role,
        content: m.content ? `${note}\n${m.content}` : `${note} (Analyzing attachments)`
      };
    }

    return { role: m.role, content: m.content || '' };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages, modelPreference } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required and must be an array' }, { status: 400 });
    }

    // Auto-detect if images are present in history
    const hasImages = messages.some((m: any) => m.images && m.images.length > 0);

    // Determine initial model order
    let primaryModel: 'minimax' | 'nemotron' = 'nemotron';
    if (modelPreference === 'minimax') {
      primaryModel = 'minimax';
    } else if (modelPreference === 'nemotron') {
      primaryModel = 'nemotron';
    } else {
      // 'auto' mode
      primaryModel = hasImages ? 'minimax' : 'nemotron';
    }

    const secondaryModel = primaryModel === 'minimax' ? 'nemotron' : 'minimax';

    // Attempt 1: Try Primary Model
    let response = await makeApiRequest(primaryModel, messages);
    let modelUsed = primaryModel;
    let fallbackTriggered = false;

    // Fallback: If primary model fails, try secondary model
    if (!response || !response.ok) {
      console.warn(`Primary model ${primaryModel} failed. Attempting fallback to ${secondaryModel}...`);
      const fallbackResponse = await makeApiRequest(secondaryModel, messages);
      if (fallbackResponse && fallbackResponse.ok) {
        response = fallbackResponse;
        modelUsed = secondaryModel;
        fallbackTriggered = true;
      }
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 500;
      const errText = response ? await response.text() : 'Network request failed';
      return NextResponse.json({ error: `All models failed. Nvidia API error: ${errText}` }, { status });
    }

    // Stream response with metadata headers
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Model-Used': modelUsed,
        'X-Fallback-Triggered': fallbackTriggered ? 'true' : 'false'
      }
    });

  } catch (error: any) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function makeApiRequest(modelType: 'minimax' | 'nemotron', messages: any[]) {
  const isMultimodal = modelType === 'minimax';
  const apiKey = isMultimodal ? MINIMAX_KEY : NEMOTRON_KEY;
  const formatted = formatMessages(messages, isMultimodal);

  const requestBody: any = {
    messages: formatted,
    temperature: 1.00,
    top_p: 0.95,
    stream: true
  };

  if (isMultimodal) {
    requestBody.model = 'minimaxai/minimax-m3';
    requestBody.max_tokens = 8192;
  } else {
    requestBody.model = 'nvidia/nemotron-3-super-120b-a12b';
    requestBody.max_tokens = 16384;
    requestBody.extra_body = {
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 16384
    };
  }

  try {
    return await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error(`Fetch error for model ${modelType}:`, err);
    return null;
  }
}
