console.log('Main JS loaded');

// Global Toast Utility using SweetAlert2
function showToast(title, message, icon = 'success') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: icon,
        title: title || message,
        text: title ? message : ''
    });
}

// Global Error Handler for Fetch
window.handleAjaxError = function (error, customMessage = 'Something went wrong') {
    console.error('AJAX Error:', error);
    showToast('Error', customMessage, 'error');
};
