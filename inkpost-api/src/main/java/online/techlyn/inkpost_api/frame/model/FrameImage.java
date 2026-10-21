package online.techlyn.inkpost_api.frame.model;

/** A frame's image in one encoding (PNG or the packed bytes), with the ETag of its pixels (D17). */
public record FrameImage(String etag, byte[] bytes) {
}
