import multer from "multer";
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);
function isPdf(buffer) {
    return buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES);
}
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter(req, file, cb) {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files are allowed"));
        }
        cb(null, true);
    },
});
export function validatePdfBuffer(buffer) {
    if (!isPdf(buffer)) {
        throw new Error("File is not a valid PDF (invalid magic bytes)");
    }
}
//# sourceMappingURL=upload.js.map