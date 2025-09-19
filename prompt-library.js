document.addEventListener('DOMContentLoaded', () => {
    const femaleTab = document.getElementById('female-tab');
    const maleTab = document.getElementById('male-tab');
    const femalePromptsContainer = document.getElementById('female-prompts');
    const malePromptsContainer = document.getElementById('male-prompts');

    const femalePrompts = [
        "Transform my photo into a Navratri look with a vibrant, mirror-work Chaniya Choli in peacock blue and green.",
        "Place me in a Gujarati village setting, wearing a traditional red and white Bandhani Chaniya Choli for Garba.",
        "Give me a modern twist on a classic look with a pastel-colored, embroidered Chaniya Choli, ready for a Dandiya night.",
        "Show me wearing a heavy, bridal-style Kutchi embroidery Chaniya Choli with intricate threadwork.",
        "Edit my picture to feature a layered, rainbow-colored Chaniya Choli, spinning gracefully during Garba.",
        "Imagine me in a royal palace, adorned in a luxurious silk Patola Chaniya Choli from Patan.",
        "Create a candid shot of me laughing, wearing a simple yet elegant cotton Chaniya Choli with block prints.",
        "Put me on a brightly lit stage, wearing a glamorous, sequined Chaniya Choli for a Navratri performance.",
        "I want to see myself in a black and gold contemporary Chaniya Choli with minimalist jewelry.",
        "Generate a portrait of me in a traditional Gamthi print Chaniya Choli, with oxidized silver jewelry."
        // Add 90 more unique female prompts here to make 100
    ];

    const malePrompts = [
        "Change my outfit to a classic, crisp white Kediyu and matching pajama for a traditional Navratri look.",
        "Show me wearing a royal blue silk Kurta with intricate gold embroidery, perfect for a festive evening.",
        "Place me in a celebratory crowd, wearing a vibrant, mirror-work embellished Kurta in bright orange.",
        "Edit my photo to feature a modern, asymmetrical black Kurta with a stylish dhoti.",
        "Imagine me looking dapper in a pastel-colored linen Kurta with subtle threadwork.",
        "Generate an image of me in a rustic, block-printed cotton Kurta, enjoying a village fair.",
        "Transform my look with a deep maroon velvet Kurta, giving off a regal and sophisticated vibe.",
        "Create a festive look with a bright yellow Kurta and a contrasting embroidered Nehru jacket.",
        "Show me in a comfortable yet stylish short Kurta with a pathani salwar for a relaxed Navratri gathering.",
        "Give me an elegant look with an off-white Chikankari Kurta, showcasing Lucknow's fine embroidery."
        // Add 90 more unique male prompts here to make 100
    ];
    
    // For demonstration, we'll just repeat the prompts to make up the numbers.
    // In a real scenario, you'd have 100 unique prompts.
    while (femalePrompts.length < 100) {
        femalePrompts.push(...femalePrompts.slice(0, 100 - femalePrompts.length));
    }
    while (malePrompts.length < 100) {
        malePrompts.push(...malePrompts.slice(0, 100 - malePrompts.length));
    }


    function createPromptCard(promptText) {
        const card = document.createElement('div');
        card.className = 'prompt-card bg-white p-5 rounded-xl border border-gray-200 flex flex-col';
        
        const text = document.createElement('p');
        text.className = 'text-gray-700 text-sm flex-grow';
        text.textContent = promptText;
        
        const button = document.createElement('button');
        button.className = 'try-now-btn mt-4 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors';
        button.textContent = 'Try Now';
        
        card.appendChild(text);
        card.appendChild(button);
        return card;
    }

    function populatePrompts(container, prompts) {
        prompts.forEach(p => {
            container.appendChild(createPromptCard(p));
        });
    }

    populatePrompts(femalePromptsContainer, femalePrompts);
    populatePrompts(malePromptsContainer, malePrompts);

    femaleTab.addEventListener('click', () => {
        femaleTab.classList.add('active');
        maleTab.classList.remove('active');
        femalePromptsContainer.classList.remove('hidden');
        malePromptsContainer.classList.add('hidden');
    });

    maleTab.addEventListener('click', () => {
        maleTab.classList.add('active');
        femaleTab.classList.remove('active');
        malePromptsContainer.classList.remove('hidden');
        femalePromptsContainer.classList.add('hidden');
    });

    document.querySelectorAll('.try-now-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const promptText = event.target.previousElementSibling.textContent;
            localStorage.setItem('selectedPrompt', promptText);
            localStorage.setItem('fromPromptLibrary', 'true');
            window.location.href = 'index.html';
        });
    });
    
    initializeCursor();
});

function initializeCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (!cursorDot || !cursorOutline) return;

    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
}
