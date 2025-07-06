const IMAGES_PER_PAGE = 12;
let currentPage = 1;
let images = [];

const form = document.getElementById("promptForm");
const image = document.getElementById("generatedImage");
const uploadInput = document.getElementById("imageUpload");
const previewBox = document.getElementById("uploadPreview");
const previewImage = document.getElementById("previewImage");
const genatorBtn = document.getElementById("generator");
const publishBtn = document.getElementById("publishBtn");
const imageLoader = document.getElementById("imageLoader");
const spinner = document.getElementById("loadingSpinner");
const gallery = document.querySelector(".gallery");

// Load images from server and render
async function loadImages() {
  try {
    const res = await fetch("https://deploy-ai-image-gen-server.onrender.com/list-images");
    const data = await res.json();
    images = data.images || [];
    currentPage = 1;
    renderGallery();
    renderPagination();
  } catch (err) {
    console.error("Failed to load images:", err);
  }
}

// Render images of current page
function renderGallery() {
  gallery.innerHTML = "";
  const start = (currentPage - 1) * IMAGES_PER_PAGE;
  const end = start + IMAGES_PER_PAGE;
  const pageImages = images.slice(start, end);
  for (const url of pageImages) {
    const div = document.createElement("div");
    div.className = "image-card";
    div.innerHTML = `<img src="${url}" alt="Image" />`;
    gallery.appendChild(div);
  }
}

// Render pagination controls
function renderPagination() {
  pagination.innerHTML = "";
  const totalPages = Math.ceil(images.length / IMAGES_PER_PAGE);
  if (totalPages <= 1) return; 

  // Prev button
  const prevBtn = document.createElement("button");
  prevBtn.textContent = "Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderGallery();
      renderPagination();
      scrollToTop();
    }
  };
  pagination.appendChild(prevBtn);

  // Page number buttons (show max 5 for neatness)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === currentPage;
    btn.onclick = () => {
      currentPage = i;
      renderGallery();
      renderPagination();
      scrollToTop();
    };
    pagination.appendChild(btn);
  }

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderGallery();
      renderPagination();
      scrollToTop();
    }
  };
  pagination.appendChild(nextBtn);
}

// Scroll to gallery top on page change
function scrollToTop() {
  gallery.scrollIntoView({ behavior: "smooth" });
}

// Initial load of gallery images
loadImages();

// Preview uploaded image
uploadInput.addEventListener("change", function () {
  const file = uploadInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImage.src = e.target.result;
      previewBox.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    previewBox.style.display = "none";
  }
});

// Generate image from prompt
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const prompt = document.getElementById("promptInput").value;

  // UI: start loading
  genatorBtn.disabled = true;
  genatorBtn.innerHTML = "Generating...";
  image.alt = "Generating...";
  image.src = "";
  publishBtn.style.display = "none";
  imageLoader.style.display = "flex";

  try {
    const response = await fetch("https://deploy-ai-image-gen-server.onrender.com/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    if (data.imageBase64) {
      const imageUrl = `data:image/png;base64,${data.imageBase64}`;
      image.src = imageUrl;
      image.alt = "Generated image";
      publishBtn.style.display = "inline-block";
    } else {
      image.alt = "No image generated.";
      alert(data.error || "Failed to generate image.");
    }
  } catch (err) {
    console.error(err);
    alert("Error generating image.");
  } finally {
    // Reset UI
    genatorBtn.disabled = false;
    genatorBtn.innerHTML = "Generate";
    imageLoader.style.display = "none";
  }
});

// Publish to Cloudinary
publishBtn.addEventListener("click", async () => {
  const base64Data = image.src;

  if (!base64Data || !base64Data.startsWith("data:image")) {
    alert("No image to publish!");
    return;
  }

  const base64 = base64Data.split(",")[1];
  spinner.style.display = "block";
  publishBtn.disabled = true;

  try {
    const response = await fetch("https://deploy-ai-image-gen-server.onrender.com/publish-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Image: base64 }),
    });

    const data = await response.json();

    if (data.url) {
      alert("✅ Published successfully!");
      publishBtn.style.display = "none";

      // Add image to gallery
      const newCard = document.createElement("div");
      newCard.className = "image-card";
      newCard.innerHTML = `<img src="${data.url}" alt="Published Image" />`;
      gallery.appendChild(newCard);
    } else {
      alert("Upload failed: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    console.error("Publish error:", error);
    alert(" Error publishing image");
  } finally {
    spinner.style.display = "none";
    publishBtn.disabled = false;
  }
});
