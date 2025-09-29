<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plans for Every Creator - GenArt</title>
    <meta name="description" content="Flexible pricing plans for GenArt AI. Choose a monthly or yearly plan and get instant credits to start creating.">
    <link rel="icon" type="image/png" href="favicon.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <!-- Razorpay Checkout Script -->
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body class="bg-slate-50 font-['Inter',_sans-serif] antialiased">
    <!-- Animated Gradient Background -->
    <div id="animated-gradient-bg"></div>

    <!-- Main App Container -->
    <div id="app-container" class="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col min-h-screen">
        
        <header class="relative flex justify-between items-center py-5">
             <a href="index.html">
                 <img src="https://iili.io/FsAoG2I.md.png" alt="GenArt Logo" class="h-7 w-auto">
            </a>
            <div id="header-auth-section" class="hidden md:flex items-center space-x-6">
                <a href="dashboard.html" class="text-sm font-medium text-slate-700 hover:text-slate-900">Dashboard</a>
                <div id="generation-counter" class="text-sm font-medium text-slate-500"></div>
                <button id="auth-btn" class="text-sm font-medium border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                    Sign In
                </button>
            </div>
            <div class="md:hidden">
                <button id="mobile-menu-btn" class="p-2 rounded-md text-slate-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
            </div>
            <div id="mobile-menu" class="hidden md:hidden absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-50 border border-slate-200">
                <div class="p-2">
                    <a href="dashboard.html" class="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">Dashboard</a>
                    <div class="border-t my-1 border-slate-200"></div>
                    <div id="mobile-generation-counter" class="px-2 py-2 text-sm text-center text-slate-600"></div>
                    <button id="mobile-auth-btn" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">
                        Sign In
                    </button>
                </div>
            </div>
        </header>

        <main class="flex-grow flex flex-col items-center justify-center text-center py-16 sm:py-24">
            <div class="w-full max-w-4xl">
                <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">Plans for every creator</h1>
                <p class="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">Credits fuel your creations, with an average generation speed of 17 seconds. Yearly plans offer the best value.</p>
                
                <!-- Billing Toggle -->
                <div class="mt-10 flex justify-center items-center space-x-4">
                    <span class="text-sm font-semibold text-slate-800">Monthly</span>
                    <label for="billing-toggle" class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="billing-toggle" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    <span class="text-sm font-semibold text-slate-800">
                        Yearly
                        <span class="ml-1 text-xs font-bold text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full">Save 15%</span>
                    </span>
                </div>
                <p class="mt-2 text-xs text-slate-500">Toggle billing: Monthly or Yearly (billed once). Yearly purchases distribute credits monthly over 12 months.</p>

                <!-- Pricing Grid -->
                <div id="pricing-grid" class="mt-12 grid md:grid-cols-3 gap-8 text-left">
                    <!-- Plan Cards will be dynamically inserted here by pricing.js -->
                </div>
            </div>
        </main>
    </div>

    <!-- Sign In Modal -->
    <div id="auth-modal" aria-hidden="true" class="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 opacity-0 invisible">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <h2 class="text-2xl font-semibold text-slate-800 mb-2">Sign In Required</h2>
            <p class="text-slate-500 mb-6">Please sign in to choose a plan.</p>
            <button id="google-signin-btn" class="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center space-x-2 transition-colors">
                 <span>Sign In with Google</span>
            </button>
            <button class="close-modal-btn mt-4 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
    </div>
    
    <!-- Checkout Summary Modal -->
    <div id="checkout-modal" aria-hidden="true" class="fixed inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 opacity-0 invisible">
        <div id="checkout-modal-content" class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-left transition-transform duration-300 scale-95">
             <!-- Modal content will be dynamically inserted here -->
        </div>
    </div>

    <script type="module" src="pricing.js"></script>
</body>
</html>
