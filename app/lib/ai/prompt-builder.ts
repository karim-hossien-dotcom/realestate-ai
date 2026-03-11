/**
 * Builds a dynamic system prompt modifier from per-user AI config.
 * Used by the Python webhook service to customize AI agent personality.
 */

export interface AiConfig {
  tone: string
  language: string
  introduction_template: string | null
  qualification_questions: string[]
  escalation_message: string | null
  closing_style: string
  property_focus: string
  custom_instructions: string | null
  active: boolean
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: 'Maintain a professional, knowledgeable tone. Be direct and efficient while still being warm.',
  casual: 'Use a relaxed, conversational tone. Feel free to use contractions and informal language. Be like a friend who happens to be great at real estate.',
  friendly: 'Be warm, enthusiastic, and approachable. Show genuine excitement about helping them. Use positive language.',
  formal: 'Use formal, polished language. Address them respectfully. Maintain decorum while being helpful.',
  luxury: 'Use refined, sophisticated language. Emphasize exclusivity, privacy, and premium service. Think concierge-level care.',
}

const CLOSING_DESCRIPTIONS: Record<string, string> = {
  direct: 'Close conversations with clear next steps and direct calls to action.',
  soft: 'End with gentle suggestions rather than hard asks. Let the lead come to you.',
  consultative: 'Wrap up by summarizing what you learned and proposing a consultative next step.',
  urgent: 'Create appropriate urgency by highlighting market timing or opportunity windows.',
}

const FOCUS_DESCRIPTIONS: Record<string, string> = {
  residential: 'You specialize in residential properties — single family homes, condos, townhouses. Frame all conversations around home buying/selling experience.',
  commercial: 'You specialize in commercial real estate — office, retail, industrial, multi-family investment. Focus on ROI, cap rates, and business objectives.',
  luxury: 'You specialize in luxury properties. Emphasize privacy, discretion, unique features, and lifestyle. Never discuss discount strategies.',
  industrial: 'You specialize in industrial properties — warehouses, manufacturing, distribution. Focus on logistics, zoning, and operational needs.',
  general: 'You handle all property types. Adapt your approach based on what the lead is looking for.',
}

/**
 * Builds a prompt modifier string from user AI config.
 * Returns empty string if config is inactive or null.
 */
export function buildPromptModifier(config: AiConfig | null): string {
  if (!config || !config.active) return ''

  const sections: string[] = []

  // Tone
  const toneDesc = TONE_DESCRIPTIONS[config.tone]
  if (toneDesc) {
    sections.push(`COMMUNICATION STYLE: ${toneDesc}`)
  }

  // Language
  if (config.language && config.language !== 'english') {
    sections.push(`LANGUAGE PREFERENCE: Respond primarily in ${config.language}. If the lead writes in another language, match their language.`)
  }

  // Property focus
  const focusDesc = FOCUS_DESCRIPTIONS[config.property_focus]
  if (focusDesc) {
    sections.push(`SPECIALIZATION: ${focusDesc}`)
  }

  // Introduction template
  if (config.introduction_template) {
    sections.push(`INTRODUCTION TEMPLATE: When greeting a new lead for the first time, use this as your opening style (adapt naturally, don't copy verbatim): "${config.introduction_template}"`)
  }

  // Custom qualification questions
  if (config.qualification_questions.length > 0) {
    const questionList = config.qualification_questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n')
    sections.push(`ADDITIONAL QUALIFICATION QUESTIONS (weave these in naturally alongside the standard checklist):\n${questionList}`)
  }

  // Escalation message
  if (config.escalation_message) {
    sections.push(`CUSTOM ESCALATION MESSAGE: When you need to escalate, use this message instead of the default: "${config.escalation_message}"`)
  }

  // Closing style
  const closingDesc = CLOSING_DESCRIPTIONS[config.closing_style]
  if (closingDesc) {
    sections.push(`CLOSING STYLE: ${closingDesc}`)
  }

  // Custom instructions
  if (config.custom_instructions) {
    sections.push(`ADDITIONAL INSTRUCTIONS FROM AGENT:\n${config.custom_instructions}`)
  }

  if (sections.length === 0) return ''

  return '\n\n===== AGENT CUSTOMIZATION =====\n' + sections.join('\n\n')
}
