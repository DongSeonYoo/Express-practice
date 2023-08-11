const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3-transform");
const sharp = require("sharp");
const path = require("path");

require("dotenv").config();

AWS.config.update({
    region: 'ap-northeast-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECERET_ACCESS_KEY
});

const s3 = new AWS.S3();
const allowedExtensions = ['.png', '.jpg', '.jpeg', '.bmp', 'png'];
const imageUploader = multer({
    storage: multerS3({
        s3: s3,
        bucket: "yoodongseon",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        shouldTransform: true,
        transforms: [
            {
                id: "resized",
                key: (req, file, callback) => {
                    const { uploadDirectory } = req.body ?? "";
                    const extension = path.extname(file.originalname);
                    if (!allowedExtensions.includes(extension)) {
                        return callback(new Error("wrong extension"));
                    }
                    callback(null, `${uploadDirectory}/${Date.now()}_${file.originalname}`)
                },
                transform: function (req, file, callback) {
                    callback(null, sharp().resize(600, 500));
                },
            },
        ],
        acl: "public-read-write"
    }),
})

module.exports = imageUploader;