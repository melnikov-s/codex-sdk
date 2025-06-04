import type { LanguageModel } from "ai";

import { anthropic } from "@ai-sdk/anthropic";
import { deepseek } from "@ai-sdk/deepseek";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export type Provider =
  | "openai"
  | "openrouter"
  | "google"
  | "ollama"
  | "mistral"
  | "deepseek"
  | "xai"
  | "groq"
  | "anthropic";
export type Model = `${Provider}/${string}`;

export function getLanguageModel(model: Model): LanguageModel {
  if (!model.includes("/")) {
    throw new Error("Invalid model format");
  }

  const [provider, name] = model.split("/") as [Provider, string];

  switch (provider) {
    case "openai":
      return openai(name as Parameters<typeof openai>[0]);
    case "deepseek":
      return deepseek(name as Parameters<typeof deepseek>[0]);
    case "google":
      return google(name as Parameters<typeof google>[0]);
    case "anthropic":
      return anthropic(name as Parameters<typeof anthropic>[0]);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getProvider(model: Model): Provider {
  if (!model.includes("/")) {
    throw new Error("Invalid model format");
  }

  const [provider] = model.split("/") as [Provider];

  return provider;
}

export const providers: Record<
  Provider,
  { name: string; baseURL: string; envKey: string }
> = {
  anthropic: {
    name: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
  },
  deepseek: {
    name: "Deepseek",
    baseURL: "https://api.deepseek.com/v1",
    envKey: "DEEPSEEK_API_KEY",
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
  },
  google: {
    name: "Google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
  ollama: {
    name: "Ollama",
    baseURL: "http://localhost:11434/v1",
    envKey: "OLLAMA_API_KEY",
  },
  mistral: {
    name: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
  },
  xai: {
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    envKey: "XAI_API_KEY",
  },
  groq: {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
  },
};
