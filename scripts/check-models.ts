// Pings MODEL_FAST / MODEL_SMART on Vertex AI (ADC) and refuses Gemini 2.5. Usage: npm run check:models
import { GoogleGenAI } from '@google/genai';

const { GOOGLE_CLOUD_PROJECT: project, GOOGLE_CLOUD_LOCATION: location = 'global' } = process.env;
if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required');
const ai = new GoogleGenAI({ vertexai: true, project, location });
console.log(`project=${project} location=${location}`);

let failed = false;
for (const key of ['MODEL_FAST', 'MODEL_SMART']) {
  const id = process.env[key] ?? '';
  let problem = '';
  if (!id) problem = 'missing';
  else if (/2\.5/.test(id)) problem = 'Gemini 2.5 is not allowed';
  else {
    try {
      await ai.models.generateContent({ model: id, contents: 'Reply with OK.', config: { maxOutputTokens: 8 } });
    } catch (e) {
      problem = `unreachable: ${String(e).slice(0, 300)}`;
    }
  }
  failed ||= !!problem;
  console.log(`${problem ? 'FAIL' : 'PASS'} ${key}=${id}${problem ? ` — ${problem}` : ''}`);
}
process.exit(failed ? 1 : 0);
