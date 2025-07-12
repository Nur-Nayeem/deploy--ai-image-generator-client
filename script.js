document.addEventListener("DOMContentLoaded", () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = "https://deploy-ai-image-gen-server.onrender.com";
    // const API_BASE_URL = "http://localhost:3000";

    const IMAGES_PER_PAGE = 8;

    // --- STATE ---
    let currentPage = 1;
    let images = [];
    let isGenerating = false;
    let currentPrompt = "";

    // --- ELEMENT REFERENCES ---
    const form = document.getElementById("promptForm");
    const promptInput = document.getElementById("promptInput");
    const imageDisplayArea = document.getElementById("imageDisplayArea");
    const initialState = document.getElementById("initialState");
    const imageLoader = document.getElementById("imageLoader");
    const generatedImage = document.getElementById("generatedImage");

    const uploadInput = document.getElementById("imageUpload");
    const previewBox = document.getElementById("uploadPreview");
    const previewImage = document.getElementById("previewImage");
    const removeUploadBtn = document.getElementById("removeUploadBtn");

    const generatorBtn = document.getElementById("generator");
    const generatorText = document.getElementById("generatorText");
    const publishBtn = document.getElementById("publishBtn");
    const publishText = document.getElementById("publishText");

    const gallery = document.getElementById("gallery");
    const paginationContainer = document.getElementById("pagination");

    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    const imageModal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");
    const modalPrompt = document.getElementById("modalPrompt");
    const closeModalBtn = document.getElementById("closeModalBtn");

    // --- SOCKET.IO SETUP ---
    const socket = io(API_BASE_URL);

    socket.on("connect", () => {
        console.log("Connected to real-time server!");
    });

    socket.on("new-image", (newImage) => {
        console.log("New image received:", newImage);
        // Add the new image to the start of the array
        images.unshift(newImage);
        // Re-render the gallery to show the new image
        renderGallery();
        renderPagination();
        showToast("A new image was just published!", "success");
    });

    const clearTextareaOnLoad = () => {
        promptInput.value = "";
    };

    // UI Update: Show a toast notification
    const showToast = (message, type = "success") => {
        toastMessage.textContent = message;
        toast.className = `fixed bottom-5 right-5 py-3 px-5 rounded-lg shadow-2xl border transform toast-in ${type === "success"
            ? "bg-green-600 border-green-500"
            : "bg-red-600 border-red-500"
            }`;
        toast.style.display = "block";

        setTimeout(() => {
            toast.classList.replace("toast-in", "toast-out");
            setTimeout(() => {
                toast.style.display = "none";
            }, 300);
        }, 3000);
    };

    // UI Update: Set the state of the image display
    const setDisplayState = (state) => {
        initialState.classList.add("hidden");
        imageLoader.classList.add("hidden");
        generatedImage.classList.add("hidden");

        switch (state) {
            case "loading":
                imageLoader.classList.remove("hidden");
                break;
            case "result":
                generatedImage.classList.remove("hidden");
                break;
            case "initial":
            default:
                initialState.classList.remove("hidden");
                break;
        }
    };

    // Gallery: Load images from the server
    const loadImages = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/list-images`);
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            const data = await res.json();
            images = data.images || [];
            currentPage = 1;
            renderGallery();
            renderPagination();
        } catch (err) {
            console.error("Failed to load images:", err);
            showToast("Could not load gallery images.", "error");
        }
    };

    // Gallery: Render images for the current page
    const renderGallery = () => {
        gallery.innerHTML = "";
        if (images.length === 0) {
            gallery.innerHTML = `<p class="col-span-full text-center text-gray-500">The gallery is empty. Create something!</p>`;
            return;
        }
        const start = (currentPage - 1) * IMAGES_PER_PAGE;
        const end = start + IMAGES_PER_PAGE;
        const pageImages = images.slice(start, end);

        pageImages.forEach((image) => {
            const itemContainer = document.createElement("div");
            itemContainer.className =
                "gallery-item w-full rounded-lg shadow-md transform hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden";

            const img = document.createElement("img");
            img.src = image.url;
            img.alt = image.prompt;
            img.loading = "lazy";
            img.className = "w-full";

            const promptOverlay = document.createElement("div");
            promptOverlay.className = "prompt-overlay";
            promptOverlay.textContent = image.prompt;

            itemContainer.appendChild(img);
            itemContainer.appendChild(promptOverlay);

            itemContainer.onclick = () => {
                modalImage.src = image.url;
                modalPrompt.textContent = image.prompt;
                imageModal.classList.remove("hidden");
            };
            gallery.appendChild(itemContainer);
        });
    };

    // Gallery: Render pagination controls
    const renderPagination = () => {
        paginationContainer.innerHTML = "";
        const totalPages = Math.ceil(images.length / IMAGES_PER_PAGE);
        if (totalPages <= 1) return;

        const createButton = (
            text,
            onClick,
            isDisabled = false,
            isActive = false
        ) => {
            const btn = document.createElement("button");
            btn.innerHTML = text;
            btn.disabled = isDisabled;
            btn.onclick = onClick;
            btn.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors ${isActive
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`;
            return btn;
        };

        const prevBtn = createButton(
            "Prev",
            () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderGallery();
                    renderPagination();
                }
            },
            currentPage === 1
        );
        paginationContainer.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = createButton(
                i,
                () => {
                    currentPage = i;
                    renderGallery();
                    renderPagination();
                },
                false,
                i === currentPage
            );
            paginationContainer.appendChild(pageBtn);
        }

        const nextBtn = createButton(
            "Next",
            () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderGallery();
                    renderPagination();
                }
            },
            currentPage === totalPages
        );
        paginationContainer.appendChild(nextBtn);
    };

    // Event Handler: Image Generation
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isGenerating) return;

        const prompt = promptInput.value.trim();
        const file = uploadInput.files[0];

        if (!prompt) {
            showToast("Please enter a prompt.", "error");
            return;
        }

        currentPrompt = prompt; // Store the prompt
        imageDisplayArea.classList.remove("hidden");

        isGenerating = true;
        generatorBtn.disabled = true;
        generatorText.textContent = "Generating...";
        setDisplayState("loading");
        publishBtn.classList.add("hidden");

        try {
            let data;

            if (file) {
                // Convert image to base64 using FileReader wrapped in a Promise
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result;
                        if (result) {
                            resolve(result.split(",")[1]); // remove data:image/... prefix
                        } else {
                            reject("Failed to read image file");
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const response = await fetch(
                    `${API_BASE_URL}/generate-image-from-text-and-image`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt, image: base64Image }),
                    }
                );

                data = await response.json();
            } else {
                const response = await fetch(`${API_BASE_URL}/generate-image`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt }),
                });

                data = await response.json();
            }

            if (data.imageBase64) {
                const imageUrl = `data:image/png;base64,${data.imageBase64}`;
                generatedImage.src = imageUrl;
                setDisplayState("result");
                publishBtn.classList.remove("hidden");
                publishBtn.classList.add("flex");
                showToast("Image generated successfully!", "success");
            } else {
                throw new Error(data.error || "Failed to generate image.");
            }
        } catch (err) {
            console.error(err);
            showToast(err.message || "Something went wrong.", "error");
            setDisplayState("initial");
        } finally {
            isGenerating = false;
            generatorBtn.disabled = false;
            generatorText.textContent = "Generate";
        }
    });

    // Event Handler: Publish Image
    publishBtn.addEventListener("click", async () => {
        const base64Data = generatedImage.src;

        if (!base64Data || !base64Data.startsWith("data:image")) {
            showToast("No image to publish!", "error");
            return;
        }

        const base64 = base64Data.split(",")[1];
        publishBtn.disabled = true;
        publishText.textContent = "Publishing...";

        try {
            const response = await fetch(`${API_BASE_URL}/publish-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base64Image: base64, prompt: currentPrompt }), // Send prompt with image
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Upload failed.");
            }

            // The socket event will handle the UI update, so we don't need to do it here.
            // We just hide the publish button and show a success message.
            publishBtn.classList.add("hidden");
            showToast("✅ Published successfully!", "success");
        } catch (error) {
            console.error("Publish error:", error);
            showToast(error.message, "error");
        } finally {
            publishBtn.disabled = false;
            publishText.textContent = "Publish";
        }
    });

    // Event Handler: Preview uploaded image
    uploadInput.addEventListener("change", function () {
        const file = uploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImage.src = e.target.result;
                previewBox.classList.remove("hidden");
            };
            reader.readAsDataURL(file);
        } else {
            previewBox.classList.add("hidden");
        }
    });

    // Event Handler: Remove uploaded image
    removeUploadBtn.addEventListener("click", () => {
        uploadInput.value = null; // Clear the file input
        previewImage.src = ""; // Clear the image source
        previewBox.classList.add("hidden"); // Hide the preview box
    });

    // Event Handlers: Modal
    const closeModal = () => imageModal.classList.add("hidden");
    closeModalBtn.addEventListener("click", closeModal);
    imageModal.addEventListener("click", (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });

    // --- INITIALIZATION ---
    lucide.createIcons();
    clearTextareaOnLoad();
    loadImages();
});
