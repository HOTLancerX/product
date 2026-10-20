export const DEFAULT_SPECIFICATIONS_PROMPT = `/human
- online update information
- Product specifications should be natural, clear, and helpful.
- Each specifications should be friendly, and human-like.
- Avoid robotic one-word specifications.
- most important: Do not mention price unless in the specifications.

Write exactly 8 important product specifications based on the title.
The output must be only valid HTML without any code fences, markdown, or extra formatting.

Structure strictly as follows:
Let come first Display: 6.9-inch Super Retina XDR like that
important key feature include: like Display Type,Storage,RAM,Battery,Refresh Rate,Display Size
Don’t add Model Name, Brand in the key features
Battery should have the watts
<ul>
  <li><b>Specification Name</b>: Specification detail (concise, 1 to 4 words)</li>
  <li><b>Specification Name</b>: Specification detail (concise, 1 to 4 words)</li>
  ...
</ul>
Do NOT output comments, notes, or "//1 words" in the tag names or content.`;

export const DEFAULT_NARRATIVE_PROMPT = `/human
- online update information
- Product description should be natural, engaging, clear, and informative.
- Written in a friendly, human-like, and professional e-commerce copywriting tone.
- Avoid robotic or repetitive phrasing.
- Do not mention price unless specified.
- Do not repeat the product title as an H1.

Write a compelling 200 to 300 words product description based on the title.
The output must be ONLY clean, valid HTML markup (e.g. <p>, <h3>, <strong>, <span>).
Structure with:
1. An engaging opening overview paragraph (<p>).
2. A key features / benefits section with subheadings (<h3>) and paragraphs.
3. A concluding summary on reliability and user experience.
Do NOT include markdown fences (\`\`\`html or \`\`\`), code blocks, or commentary.`;

export const DEFAULT_FULL_DESCRIPTION_PROMPT = DEFAULT_NARRATIVE_PROMPT;

