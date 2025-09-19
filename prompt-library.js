document.addEventListener('DOMContentLoaded', () => {
    const femalePromptsContainer = document.querySelector('.grid > div:nth-child(1) .prompt-list');
    const malePromptsContainer = document.querySelector('.grid > div:nth-child(2) .prompt-list');

    const femalePrompts = [
        "A beautiful woman wearing a vibrant red and orange Bandhani chaniya choli with intricate mirror work, dancing gracefully at a Garba night, cinematic lighting, ultra-realistic.",
        "Elegant woman in a royal blue Ghagra choli with heavy Kutch embroidery, detailed threadwork, silver jewelry, festive night background, photorealistic, 8k.",
        "Woman in a modern pastel green and pink Leheriya chaniya choli with a contemporary blouse design, subtle sequins, soft focus, Navratri decorations in the background.",
        "Close-up portrait of a woman in a traditional black and gold chaniya choli, oxidized silver necklace, expressive eyes, bokeh background of temple lights, depth of field.",
        "Full-length shot of a woman twirling in a multi-layered yellow Patola print chaniya choli, dynamic motion blur, energetic atmosphere, professional photography.",
        "Woman wearing a white chaniya choli with colorful pom-pom tassels and mirror work, smiling brightly, Dandiya sticks in hand, candid style, warm lighting.",
        "A woman in a deep maroon velvet chaniya choli with Zari border, antique gold jewelry, dramatic shadows, looking regal and powerful, fine art portrait.",
        "Joyful woman in a peacock green and blue chaniya choli, intricate beadwork, festive makeup, laughing with friends, motion shot, vibrant colors.",
        "Woman in a simple yet elegant cotton block-print chaniya choli in earthy tones, minimal jewelry, daytime Navratri event, natural sunlight, sharp focus.",
        "Artistic shot of a woman in a tie-dye style pink and purple chaniya choli, backless blouse design, silhouetted against a large bonfire, mystical ambiance.",
        // ... (90 more female prompts)
        "Woman in a striking magenta chaniya choli with silver gota patti work, elegant updo hairstyle, sophisticated look for a Navratri party, high fashion.",
        "A woman showcasing the back of a beautifully embroidered blouse, part of a green silk chaniya choli, intricate details, artistic lighting.",
        "Candid photo of a woman in a bright yellow chaniya choli, laughing heartily, blurred background of a bustling Navratri fair, genuine emotion.",
        "Woman in a traditional Gujarati chaniya choli with abhla (mirror) work, wearing a colorful bandhani dupatta, looking graceful, cultural portrait.",
        "Elegant portrait of a woman in a black chaniya choli with multi-color thread embroidery, classic pose, studio lighting, timeless beauty.",
        "Woman wearing a fusion-style chaniya choli with a jacket, modern interpretation of Navratri fashion, urban setting, editorial style.",
        "A woman in a sky-blue chaniya choli with white chikankari work, pearl jewelry, serene expression, peaceful festive morning, soft and airy photo.",
        "Dynamic shot of a woman playing Garba, her layered orange and teal chaniya choli swirling around her, full of energy and movement, festive lights.",
        "Woman in a regal purple chaniya choli with intricate zardozi embroidery, heavy gold jewelry, looking like royalty, opulent setting, rich textures.",
        "Close-up of the detailed mirror work on a vibrant pink chaniya choli, hands adorned with bangles and mehendi, focus on craftsmanship, macro photography."
    ];

    const malePrompts = [
        "A handsome man in a royal blue silk kurta with fine gold embroidery on the collar and cuffs, looking charismatic at a Navratri event, cinematic lighting.",
        "Man wearing a traditional white cotton kurta with a colorful Kutch embroidered jacket (koti), holding Dandiya sticks, energetic and festive mood, ultra-realistic.",
        "A man in a modern black asymmetrical kurta with a stylish cut, paired with white pajamas, sophisticated and contemporary look, night-time city background.",
        "Full-length shot of a man in a vibrant yellow Pathani suit with a draped dupatta, smiling confidently, festive decorations around, photorealistic, 8k.",
        "Man in a deep maroon kurta with subtle self-design fabric, paired with a cream dhoti, classic and timeless ethnic look, temple background, soft focus.",
        "A man wearing a simple yet elegant linen kurta in a pastel green shade, relaxed fit, daytime Navratri celebration, natural sunlight, candid portrait.",
        "Close-up of a man in a black kurta featuring intricate mirror work on the neckline, sharp details, dramatic lighting, intense expression.",
        "Man in a bright orange short kurta paired with jeans, a modern fusion look for Navratri, urban street style, dynamic and youthful.",
        "A man wearing a printed kurta with traditional motifs, paired with a Nehru jacket, looking distinguished and cultural, festive family gathering.",
        "Artistic shot of a man in a flowing white kurta, silhouetted against a bonfire during a Garba night, spiritual and serene ambiance.",
        // ... (90 more male prompts)
        "Man in a sophisticated grey silk kurta with minimalistic silver threadwork, looking elegant and understated at a festive party, high fashion.",
        "A man showing the detailed block print on his earthy-toned cotton kurta, focus on the fabric and pattern, natural and rustic feel.",
        "Candid photo of a man laughing while dancing, wearing a vibrant green kurta, genuine joy, blurred background of the dance circle.",
        "Man in a traditional Gujarati kediyu-style kurta with colorful embroidery and tassels, full of cultural richness, folk festival setting.",
        "Elegant portrait of a man in a deep navy blue kurta with a contrasting red dupatta, classic pose, studio lighting, confident and handsome.",
        "Man wearing a modern draped kurta in a unique color like teal or wine, fusion fashion for a festive occasion, editorial style.",
        "A man in a crisp white Lucknowi chikankari kurta, looking serene and pure, morning prayers at a temple, soft and ethereal lighting.",
        "Dynamic shot of a man playing Dandiya, his energetic movement captured, wearing a comfortable yet stylish red kurta, action shot.",
        "Man in an opulent black velvet kurta with gold zardozi embroidery, looking regal and majestic, grand festive palace background.",
        "Close-up of the intricate threadwork on a man's kurta sleeve, hand resting on a traditional musical instrument, focus on cultural details, artistic."
    ];
    
    // Add a helper to fill the containers
    const createPromptEntry = (promptText) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg';
        
        const p = document.createElement('p');
        p.className = 'text-sm text-gray-700 flex-1 mr-4';
        p.textContent = promptText;

        const button = document.createElement('button');
        button.className = 'try-now-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs py-1.5 px-3 rounded-full transition-transform duration-200 ease-in-out hover:scale-105 flex-shrink-0';
        button.textContent = 'Try Now';
        button.addEventListener('click', () => {
            // Save the prompt to localStorage
            localStorage.setItem('selectedPrompt', promptText);
            // Redirect to the main page
            window.location.href = 'index.html';
        });

        div.append(p, button);
        return div;
    };

    femalePromptsContainer.innerHTML = '';
    malePromptsContainer.innerHTML = '';

    femalePrompts.forEach(prompt => femalePromptsContainer.appendChild(createPromptEntry(prompt)));
    malePrompts.forEach(prompt => malePromptsContainer.appendChild(createPromptEntry(prompt)));

    // Custom cursor logic
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (cursorDot && cursorOutline) {
        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;
            cursorDot.style.left = `${posX}px`;
            cursorDot.style.top = `${posY}px`;
            cursorOutline.style.left = `${posX}px`;
            cursorOutline.style.top = `${posY}px`;
        });
        document.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
            el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
        });
    }
});
