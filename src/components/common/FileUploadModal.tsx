import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

export interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "files" | "images" | "embed";
    onSaveEmbeddedLink: (url: string, type: string, caption?: string) => void;
    selectedOption?: string;
    onSaveImage?: (url: string, caption: string) => void;
    setSavingImage?: (url: string) => void;
}

export default function FileUploadModal({
    isOpen,
    onClose,
    mode,
    onSaveEmbeddedLink,
    selectedOption,
    onSaveImage,
    setSavingImage,
}: FileUploadModalProps) {
    const [activeTab, setActiveTab] = useState<"files" | "url">("files");
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [isUploadActive, setIsUploadActive] = useState(false);
    const [caption, _setCaption] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActiveTab(mode === "embed" ? "url" : "files");
    }, [mode]);

    useEffect(() => {
        setIsUploadActive(files.length > 0 || url.trim() !== "");
    }, [files, url]);

    useEffect(() => {
        if (!isOpen) {
            setUrl("");
            setFiles([]);
            setError("");
            setIsUploadActive(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validateUrl = (inputUrl: string, _type: string): { isValid: boolean; error?: string } => {
        if (!inputUrl.trim()) {
            return { isValid: false, error: "URL cannot be empty" };
        }

        if (!inputUrl.startsWith("http://") && !inputUrl.startsWith("https://")) {
            return {
                isValid: false,
                error: "Incorrect HTTP URL, enter a valid URL, starting with http:// or https://.",
            };
        }

        return { isValid: true };
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            if (mode === "images") {
                const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
                    file.type.startsWith("image/")
                );
                setFiles(imageFiles);
            } else {
                setFiles(Array.from(e.dataTransfer.files));
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            if (mode === "images") {
                const imageFiles = Array.from(e.target.files).filter((file) =>
                    file.type.startsWith("image/")
                );
                setFiles(imageFiles);
            } else {
                setFiles(Array.from(e.target.files));
            }
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        if (error) setError("");
    };

    const uploadImageToCloudinary = async (file: File) => {
        try {
            setIsUploading(true);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "blog_upload");

            const response = await fetch(
                "https://api.cloudinary.com/v1_1/djv9l3o8n/image/upload",
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!response.ok) throw new Error("Failed to upload image");

            const data = await response.json();
            if (setSavingImage) setSavingImage(data.secure_url);

            if (data.secure_url && onSaveImage) {
                onSaveImage(data.secure_url, caption);
            }
            onClose();
        } catch (error) {
            console.error("Error uploading image:", error);
            setError("Failed to upload image. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleInsert = () => {
        if (mode === "embed" && url.trim()) {
            const validation = validateUrl(url, selectedOption || "");
            if (validation.isValid) {
                onSaveEmbeddedLink(url, selectedOption || "url", caption);
                onClose();
            } else {
                setError(validation.error || "Invalid URL");
            }
        } else if (mode === "images" && files.length > 0) {
            uploadImageToCloudinary(files[0]);
        }
    };

    const renderContent = () => {
        if (mode === "embed" || activeTab === "url") {
            return (
                <div className="pe-8 pb-4 mb-7">
                    <p className="text-sm text-gray-600 mb-6">
                        Insert a URL to embed.
                    </p>
                    <div className="space-y-1">
                        <input
                            type="url"
                            className="w-full px-3 py-1 border focus:ring-0 rounded-md text-sm focus:outline-none border-blue-500"
                            placeholder="Paste a URL"
                            value={url}
                            onChange={handleUrlChange}
                        />
                        {error && <p className="text-xs text-red-500">{error}</p>}
                    </div>
                </div>
            );
        }

        return (
            <div className="p-1 mb-16">
                <div
                    className={`relative cursor-pointer rounded-md bg-blue-50 border border-dashed border-blue-900 p-4 ${dragActive ? "border-blue-600 bg-blue-100" : "border-gray-300"
                        } flex flex-col items-center justify-center gap-2`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <div className="text-center">
                        <p className="text-sm text-blue-800">Drop your files or browse</p>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple={mode !== "images"}
                        accept={mode === "images" ? "image/*" : undefined}
                        onChange={handleChange}
                        className="hidden"
                    />
                </div>
                {files.length > 0 && (
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Selected {mode === "images" ? "Image" : "Files"}:
                        </h4>
                        <ul className="text-sm text-gray-600">
                            {files.map((file, index) => (
                                <li key={index}>{file.name}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {error && <p className="text-xs mt-2 text-red-500">{error}</p>}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60"
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-center justify-center min-h-screen p-4">
                <div ref={modalRef} className="bg-white rounded-lg w-full max-w-[600px]">
                    <div className="px-6 pt-4 pb-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl mt-6 font-medium text-gray-900">
                                {mode === "files"
                                    ? "Select files"
                                    : mode === "images"
                                        ? "Select image"
                                        : "Embed a URL"}
                            </h3>
                            <button onClick={onClose} className="text-gray-400 pb-10 hover:text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {mode !== "embed" && (
                            <nav className="flex mt-2 border-b">
                                <button
                                    onClick={() => setActiveTab("files")}
                                    className={`${activeTab === "files"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-gray-500"
                                        } mr-4 py-2 text-sm font-medium border-b-2 transition-colors`}
                                >
                                    Files
                                </button>
                                <button
                                    onClick={() => setActiveTab("url")}
                                    className={`${activeTab === "url"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-gray-500"
                                        } py-2 text-sm font-medium border-b-2 transition-colors`}
                                >
                                    URL
                                </button>
                            </nav>
                        )}
                        <div className="mt-4">{renderContent()}</div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-gray-200 mt-4 px-6 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleInsert}
                            disabled={!isUploadActive || isUploading}
                            className={`px-3 py-1 text-sm font-medium text-white rounded-md ${isUploadActive && !isUploading
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-gray-300 cursor-not-allowed"
                                }`}
                        >
                            {isUploading
                                ? "Uploading..."
                                : mode === "embed"
                                    ? "Insert"
                                    : "Upload"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
