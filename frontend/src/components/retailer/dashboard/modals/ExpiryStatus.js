// src/utils/expiryUtils.js

export const calculateExpiryStatus = (product) => {
    const now = new Date();
    let status = 'safe';

    for (const entry of product.stockEntries) {
        if (!entry.expiryDate) continue;

        const expiryDate = new Date(entry.expiryDate);
        const timeDiff = expiryDate - now;
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysUntilExpiry <= 0) {
            return 'expired';
        } else if (daysUntilExpiry <= 30) {
            status = 'danger';
        } else if (daysUntilExpiry <= 90 && status !== 'danger') {
            status = 'warning';
        }
    }

    return status;
};
