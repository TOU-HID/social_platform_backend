"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageBufferToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const env_1 = require("./env");
if (env_1.env.useCloudinary) {
    if (!env_1.env.cloudinaryCloudName ||
        !env_1.env.cloudinaryApiKey ||
        !env_1.env.cloudinaryApiSecret) {
        throw new Error('USE_CLOUDINARY=true but Cloudinary credentials are missing (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
    }
    cloudinary_1.v2.config({
        cloud_name: env_1.env.cloudinaryCloudName,
        api_key: env_1.env.cloudinaryApiKey,
        api_secret: env_1.env.cloudinaryApiSecret,
        secure: true,
    });
}
const uploadImageBufferToCloudinary = async (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({
            folder: env_1.env.cloudinaryFolder,
            resource_type: 'image',
        }, (error, result) => {
            if (error || !result?.secure_url) {
                reject(error || new Error('Cloudinary upload failed'));
                return;
            }
            resolve(result.secure_url);
        });
        stream.end(buffer);
    });
};
exports.uploadImageBufferToCloudinary = uploadImageBufferToCloudinary;
