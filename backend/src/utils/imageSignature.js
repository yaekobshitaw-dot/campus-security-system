const fs = require('fs');

const hasValidImageSignature = async(filePath, mimetype) => {
    const handle = await fs.promises.open(filePath, 'r');
    const header = Buffer.alloc(12);
    let bytesRead;
    try {
        ({ bytesRead } = await handle.read(header, 0, header.length, 0));
    } finally {
        await handle.close();
    }

    const bytes = header.subarray(0, bytesRead);
    if (mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimetype === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
    return false;
};

module.exports = { hasValidImageSignature };