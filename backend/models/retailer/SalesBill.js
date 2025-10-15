const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SalesBillSchema = new Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    firstPrinted: {
        type: Boolean,
        default: false
    },
    printCount: {
        type: Number,
        default: 0
    },
    purchaseSalesType: { type: String, required: true },
    originalCopies: { type: Number, default: 1 },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    billNumber: { type: String, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    cashAccount: { type: String },
    cashAccountAddress: { type: String },
    cashAccountPan: { type: String },
    cashAccountEmail: { type: String },
    cashAccountPhone: { type: String },
    settings: { type: mongoose.Schema.Types.ObjectId, ref: 'Settings' },
    fiscalYear: {
        type: Schema.Types.ObjectId,
        ref: 'FiscalYear',
        required: true
    },
    items: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
        quantity: { type: Number, required: true },  // Required in item schema
        price: { type: Number, required: true },     // Required in item schema
        puPrice: { type: Number },
        netPuPrice: { type: Number },
        discountPercentagePerItem: {
            type: Number,
            default: 0,
        },
        discountAmountPerItem: {
            type: Number,
            default: 0,
        },
        netPrice: {
            type: Number,
            default: 0,
        },
        batchNumber: { type: String },
        expiryDate: { type: Date },
        vatStatus: {
            type: String,
            required: true,
            enum: ['vatable', 'vatExempt']
        },
        uniqueUuId: { type: String },
        purchaseBillId: { type: String }
    }],
    subTotal: { type: Number, default: 0 },
    nonVatSales: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    discountPercentage: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    vatPercentage: { type: Number, default: 13 },
    vatAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    isVatExempt: { type: Boolean, default: false },
    isVatAll: { type: String },
    roundOffAmount: { type: Number, default: 0 },
    paymentMode: { type: String },
    date: { type: Date, default: Date.now },
    transactionDate: { type: Date, default: Date.now }
});

// Unique constraint for sales bills
SalesBillSchema.index({ billNumber: 1, company: 1, fiscalYear: 1 }, { unique: true });

module.exports = mongoose.model('SalesBill', SalesBillSchema);
