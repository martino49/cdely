exports.generateTransactionRef = () => {
    return 'TXN-' + Date.now() + Math.floor(Math.random() * 1000);
};

exports.generateOrderNumber = () => {
    return 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
};
