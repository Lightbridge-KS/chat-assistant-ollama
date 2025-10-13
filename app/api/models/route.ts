import ollama from "ollama";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await ollama.list();

    // Extract name from each model
    const modelList = response.models.map((m) => ({
      name: m.name,
      model: m.model,
    }));

    return NextResponse.json(modelList);
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models. Is Ollama running?" },
      { status: 500 }
    );
  }
}
