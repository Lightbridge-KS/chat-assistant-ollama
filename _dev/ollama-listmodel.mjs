import ollama from 'ollama';

const response = await ollama.list();

// Extract name and model from each model
const modelList = response.models.map(m => ({
  name: m.name, // Use name in the app dropdown
  model: m.model
}));

console.log(modelList);