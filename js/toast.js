window.showToast = function(type, message, actionText = null, autoDismiss = true) {
    return new Promise((resolve) => {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();
        
        const toast = document.createElement('div');
        
        let bgColor, iconHtml;
        if (type === 'success') {
            bgColor = 'bg-green-50 border border-green-200 text-green-800';
            iconHtml = `<svg class="w-6 h-6 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        } else if (type === 'error') {
            bgColor = 'bg-red-50 border border-red-200 text-red-800';
            iconHtml = `<svg class="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            autoDismiss = false;
        } else if (type === 'warning') {
            bgColor = 'bg-yellow-50 border border-yellow-200 text-yellow-800';
            iconHtml = `<svg class="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
        } else {
            bgColor = 'bg-blue-50 border border-blue-200 text-blue-800';
            iconHtml = `<svg class="w-6 h-6 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.className = `flex items-start space-x-3 p-4 rounded-xl shadow-xl max-w-sm w-full z-50 mb-3 transform translate-x-full opacity-0 transition-all duration-300 ${bgColor}`;
        
        let actionHtml = '';
        if (actionText) {
            actionHtml = `<button class="mt-2 text-sm font-bold underline hover:opacity-80">${actionText}</button>`;
        } else if (type === 'error' || type === 'warning') {
            actionHtml = `<button class="mt-2 text-sm font-bold underline hover:opacity-80">Tutup</button>`; // default fallback
        }

        toast.innerHTML = `
            ${iconHtml}
            <div class="flex-1">
                <p class="text-sm font-semibold leading-snug whitespace-pre-line">${message}</p>
                ${actionHtml}
            </div>
            <button class="text-gray-400 hover:text-gray-600 shrink-0 btn-close">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        const closeToast = (val) => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
            resolve(val);
        };

        const closeBtn = toast.querySelector('.btn-close');
        if (closeBtn) closeBtn.addEventListener('click', () => closeToast(false));
         
        const actionBtn = toast.querySelector('button.underline');
        if (actionBtn) {
            actionBtn.addEventListener('click', () => closeToast(true));
        }

        if (autoDismiss) {
            setTimeout(() => {
                if (document.body.contains(toast)) closeToast(false);
            }, 5000); // 5 sec auto dismiss
        }
    });
};

window.showConfirm = function(message) {
    return new Promise((resolve) => {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();
        const toast = document.createElement('div');
        toast.className = `flex flex-col space-y-3 p-4 rounded-xl shadow-2xl max-w-sm w-full z-50 mb-3 transform translate-x-full opacity-0 transition-all duration-300 bg-white border border-gray-200 text-gray-800`;
        
        toast.innerHTML = `
            <div class="flex items-start space-x-3">
                <svg class="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p class="text-sm font-semibold leading-snug whitespace-pre-line flex-1">${message}</p>
            </div>
            <div class="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button class="px-3 py-1.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition btn-no">Batal</button>
                <button class="px-3 py-1.5 text-sm font-bold text-white bg-[#FA8112] rounded-lg hover:bg-[#e07510] shadow-md transition btn-yes">Ya, Lanjutkan</button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        const closeToast = (val) => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
            resolve(val);
        };

        toast.querySelector('.btn-no').addEventListener('click', () => closeToast(false));
        toast.querySelector('.btn-yes').addEventListener('click', () => closeToast(true));
    });
};

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col items-end pointer-events-none';
    document.body.appendChild(container);
    // enable pointer events on children
    const style = document.createElement('style');
    style.innerHTML = '#toast-container > div { pointer-events: auto; }';
    document.head.appendChild(style);
    return container;
}
