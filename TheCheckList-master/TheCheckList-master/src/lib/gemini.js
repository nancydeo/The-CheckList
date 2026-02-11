import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyBeRIkinVJcswMBjSl7ZVYE0MoOeQlligQ');

const DEFAULT_RESPONSE = {
  actionItems: [],
  meetingDetails: {
    date: 'Not specified',
    time: 'Not specified',
    participants: ['Unspecified participants']
  },
  keyPoints: ['No key points detected'],
  calendarEvents: [],
  summary: 'No summary available'
};

export async function extractInformation(text) {
  if (!text.trim()) {
    throw new Error('No text provided for analysis');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
    You are a meeting assistant AI that analyzes meeting transcripts and extracts structured information.
    Your task is to analyze the following meeting transcript and return ONLY a JSON object with no additional text or formatting.

    The JSON MUST follow this exact structure:
    {
      "actionItems": [{"task": "string", "deadline": "string"}],
      "meetingDetails": {"date": "string", "time": "string", "participants": ["string"]},
      "keyPoints": ["string"],
      "calendarEvents": [{"title": "string", "date": "string", "time": "string"}],
      "summary": "string"
    }

    Rules:
    1. Return ONLY valid JSON, no other text
    2. Use "Not specified" for missing dates/times
    3. Use ["Unspecified participants"] when no participants are mentioned
    4. If no action items found, use empty array []
    5. If no calendar events found, use empty array []
    6. Always include a brief summary
    7. Ensure all arrays have at least one item except for actionItems and calendarEvents
    8. All string values must be properly escaped

    Analyze this transcript:
    ${text}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    // Ensure we're working with valid JSON by removing any potential markdown formatting
    const jsonString = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    try {
      const parsedResponse = JSON.parse(jsonString);
      
      // Validate the response structure
      return {
        actionItems: Array.isArray(parsedResponse.actionItems) ? parsedResponse.actionItems : [],
        meetingDetails: {
          date: parsedResponse.meetingDetails?.date || 'Not specified',
          time: parsedResponse.meetingDetails?.time || 'Not specified',
          participants: Array.isArray(parsedResponse.meetingDetails?.participants) 
            ? parsedResponse.meetingDetails.participants 
            : ['Unspecified participants']
        },
        keyPoints: Array.isArray(parsedResponse.keyPoints) && parsedResponse.keyPoints.length > 0
          ? parsedResponse.keyPoints
          : ['No key points detected'],
        calendarEvents: Array.isArray(parsedResponse.calendarEvents) 
          ? parsedResponse.calendarEvents 
          : [],
        summary: parsedResponse.summary || 'No summary available'
      };
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      return DEFAULT_RESPONSE;
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return DEFAULT_RESPONSE;
  }
}