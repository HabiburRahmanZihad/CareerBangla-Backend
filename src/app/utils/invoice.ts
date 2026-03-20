import PDFDocument from "pdfkit";

export interface InvoiceData {
    invoiceNumber: string;
    date: Date | string;
    customerName: string;
    customerEmail: string;
    planName: string;
    durationDays: number;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    couponCode: string | null;
    periodStart: Date | string;
    periodEnd: Date | string;
}

const formatDate = (d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Header
        doc.fontSize(24).font("Helvetica-Bold").text("CareerBangla", 50, 50);
        doc.fontSize(10).font("Helvetica").fillColor("#666666")
            .text("Premium Subscription Invoice", 50, 80);

        // Invoice details (right aligned)
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
            .text(`Invoice #: ${data.invoiceNumber}`, 350, 50, { align: "right" });
        doc.font("Helvetica").fillColor("#666666")
            .text(`Date: ${formatDate(data.date)}`, 350, 65, { align: "right" });

        // Separator
        doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#e0e0e0").stroke();

        // Bill To
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Bill To:", 50, 130);
        doc.fontSize(10).font("Helvetica").fillColor("#555555")
            .text(data.customerName, 50, 148)
            .text(data.customerEmail, 50, 163);

        // Subscription Period
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Subscription Period:", 350, 130);
        doc.fontSize(10).font("Helvetica").fillColor("#555555")
            .text(`${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`, 350, 148)
            .text(`${data.durationDays} days`, 350, 163);

        // Table header
        const tableTop = 210;
        doc.rect(50, tableTop, 495, 25).fill("#f5f5f5");
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
        doc.text("Description", 60, tableTop + 7);
        doc.text("Duration", 300, tableTop + 7);
        doc.text("Amount", 450, tableTop + 7, { align: "right" });

        // Table row
        const rowY = tableTop + 35;
        doc.font("Helvetica").fillColor("#555555");
        doc.text(`${data.planName} Premium Plan`, 60, rowY);
        doc.text(`${data.durationDays} days`, 300, rowY);
        doc.text(`BDT ${data.originalAmount.toLocaleString()}`, 450, rowY, { align: "right" });

        // Subtotal section
        let summaryY = rowY + 50;
        doc.moveTo(350, summaryY).lineTo(545, summaryY).strokeColor("#e0e0e0").stroke();
        summaryY += 10;

        doc.font("Helvetica").fillColor("#555555");
        doc.text("Subtotal:", 350, summaryY);
        doc.text(`BDT ${data.originalAmount.toLocaleString()}`, 450, summaryY, { align: "right" });

        if (data.discountAmount > 0) {
            summaryY += 20;
            doc.fillColor("#16a34a");
            doc.text(`Discount${data.couponCode ? ` (${data.couponCode})` : ""}:`, 350, summaryY);
            doc.text(`-BDT ${data.discountAmount.toLocaleString()}`, 450, summaryY, { align: "right" });
        }

        // Total
        summaryY += 30;
        doc.moveTo(350, summaryY).lineTo(545, summaryY).strokeColor("#333333").lineWidth(1.5).stroke();
        summaryY += 10;
        doc.fontSize(13).font("Helvetica-Bold").fillColor("#333333");
        doc.text("Total Paid:", 350, summaryY);
        doc.text(`BDT ${data.finalAmount.toLocaleString()}`, 450, summaryY, { align: "right" });

        // Status badge
        summaryY += 40;
        doc.rect(350, summaryY, 80, 22).fill("#16a34a");
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff")
            .text("PAID", 355, summaryY + 6, { width: 70, align: "center" });

        // Footer
        const footerY = 720;
        doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor("#e0e0e0").lineWidth(0.5).stroke();
        doc.fontSize(8).font("Helvetica").fillColor("#999999");
        doc.text("CareerBangla - Your Career Partner", 50, footerY + 10);
        doc.text("This is a computer-generated invoice and does not require a signature.", 50, footerY + 22);
        doc.text(`Transaction ID: ${data.invoiceNumber}`, 50, footerY + 34);

        doc.end();
    });
};
