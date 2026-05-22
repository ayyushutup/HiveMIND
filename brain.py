import os
from groq import Groq

# 1. Initialize the client. It automatically looks for GROQ_API_KEY
client = Groq()

# 2. Define the prompt
prompt = "Hello! You are the first node of HiveMind. What is your primary directive?"

print(f"Sending prompt: '{prompt}'\n")

# 3. Send the prompt to a fast Groq model (Llama 3 8B)
response = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": prompt,
        }
    ],
    model="llama-3.3-70b-versatile",
)

# 4. Print the AI's response!
print("Response from AI:")
print(response.choices[0].message.content)
