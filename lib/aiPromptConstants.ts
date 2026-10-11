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
  <li><b>Specification Name //1 words</b>: Specification detail 1 or 4 maximum wards</li>
  <li><b>Specification Name //1 words</b>: Specification detail 1 or 4 maximum wards</li>
  ...
</ul>`;

export const DEFAULT_NARRATIVE_PROMPT = `/human
- online update information
- short description should be natural, clear, and helpful.
- Each short description should be friendly, and human-like.
- Avoid robotic one-word short description.
- most important: Do not mention price unless in the short description.
- do not include title

Write exactly 200 to 300 words important short description based on the title.
The output must be only valid HTML without any code fences, markdown, or extra formatting.
include paragraph p,strong,i,h3,h4,span paragraph
Do NOT include the words "html", "\`\`\`", "code", or any markdown fences.`;
