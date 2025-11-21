// ============ API BASE URL CONFIGURATION WITH FALLBACK ============

// Main API list in priority order
const API_PRIORITY_LIST = [
    process.env.REACT_APP_API_URL,                  // 1. React Environment API
    'http://localhost:3000/api',                    // 2. Localhost primary
    'http://localhost:5500/api',                    // 3. Localhost secondary
    'https://interior-design-6mqd.onrender.com/api' // 4. Production Render API (fallback)
].filter(Boolean); // Remove undefined entries

// Final selected API
let API_BASE_URL = API_PRIORITY_LIST[0];

console.log("Initial API Base URL:", API_BASE_URL);

// ============ CHECK & SWITCH API AUTOMATICALLY ============
(async () => {
    for (let api of API_PRIORITY_LIST) {
        try {
            const res = await fetch(`${api}/health`, { method: "GET" });

            if (res.ok) {
                API_BASE_URL = api;
                console.log("✔ Using API:", API_BASE_URL);
                break;
            } else {
                console.warn(`❌ Health check failed for: ${api}`);
            }
        } catch (err) {
            console.warn(`⚠ Could not reach: ${api}`);
        }
    }
})();

export default API_BASE_URL;


        // Global state
        let isAdmin = false;
        let designs = [];
        let videos = [];
        let currentImageFile = null;

        // Mobile Navigation Toggle
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
        
        // Modal Elements
        const modal = document.getElementById('designModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalImage = document.getElementById('modalImage');
        const modalDescription = document.getElementById('modalDescription');
        const whatsappLink = document.getElementById('whatsappLink');
        const emailLink = document.getElementById('emailLink');
        const backToGallery = document.getElementById('backToGallery');
        const closeBtn = document.querySelectorAll('.close-btn');
        
        // Admin Elements
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        const loginModal = document.getElementById('loginModal');
        const loginForm = document.getElementById('loginForm');
        const closeLoginModal = document.getElementById('closeLoginModal');
        const adminDesignModal = document.getElementById('adminDesignModal');
        const adminDesignForm = document.getElementById('adminDesignForm');
        const addDesignBtn = document.getElementById('addDesignBtn');
        const addDesignBtnContainer = document.getElementById('addDesignBtnContainer');
        const saveDesignBtn = document.getElementById('saveDesignBtn');
        const cancelDesignBtn = document.getElementById('cancelDesignBtn');
        const designGallery = document.getElementById('designGallery');
        const designImageInput = document.getElementById('designImage');
        const fileInputLabel = document.getElementById('fileInputLabel');
        const imagePreview = document.getElementById('imagePreview');
        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // Video elements
        const videosGrid = document.getElementById('videosGrid');
        const addVideoBtn = document.getElementById('addVideoBtn');
        const addVideoBtnContainer = document.getElementById('addVideoBtnContainer');
        const videoUploadModal = document.getElementById('videoUploadModal');
        const videoUploadForm = document.getElementById('videoUploadForm');
        const uploadVideoBtn = document.getElementById('uploadVideoBtn');
        const cancelVideoBtn = document.getElementById('cancelVideoBtn');
        
        // File input handling
        designImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentImageFile = file;
                fileInputLabel.textContent = file.name;
                fileInputLabel.classList.add('has-file');
                
                // Show preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Open Modal when Design Image is Clicked
        function openDesignModal(design) {
            modalTitle.textContent = design.title;
            modalImage.src = `${API_BASE_URL}/uploads/${design.image}`;
            modalDescription.textContent = design.description;
            whatsappLink.href = `https://wa.me/+234816262854?text=Hi%20Pure%20Pleasure%20Building%20and%20Interior%20Concept!%20I'm%20interested%20in%20the%20${encodeURIComponent(design.title)}%20design.%20Please%20send%20me%20more%20information.`;
            emailLink.href = `mailto:Abrahamuwaoma71@gmail.com?subject=Inquiry about ${encodeURIComponent(design.title)} Design`;
            
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        
        // Close Modal
        function closeModal() {
            modal.style.display = 'none';
            loginModal.style.display = 'none';
            adminDesignModal.style.display = 'none';
            videoUploadModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        closeBtn.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        
        backToGallery.addEventListener('click', closeModal);
        closeLoginModal.addEventListener('click', closeModal);
        cancelDesignBtn.addEventListener('click', closeModal);
        cancelVideoBtn.addEventListener('click', closeModal);
        
        // Close Modal when clicking outside content
        window.addEventListener('click', (e) => {
            if (e.target === modal || e.target === loginModal || e.target === adminDesignModal || e.target === videoUploadModal) {
                closeModal();
            }
        });
        
        // Contact Form Submission to WhatsApp
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const message = document.getElementById('message').value;
            
            // Create WhatsApp message
            const whatsappMessage = `Hello Pure Pleasure Building and Interior Concept!%0A%0AMy name is ${name}.%0AEmail: ${email}%0APhone: ${phone}%0A%0AMessage:%0A${message}`;
            
            // Open WhatsApp with pre-filled message
            window.open(`https://wa.me/+234816262854?text=${whatsappMessage}`, '_blank');
            
            // Show success message
            alert('Thank you for your message! You will be redirected to WhatsApp to send your inquiry.');
            
            // Reset form
            this.reset();
        });
        
        // Admin Login
        adminLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(`${API_BASE_URL}/admin/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    isAdmin = true;
                    localStorage.setItem('adminToken', data.token);
                    addDesignBtnContainer.style.display = 'block';
                    addVideoBtnContainer.style.display = 'block';
                    closeModal();
                    alert('Admin login successful!');
                } else {
                    alert('Invalid credentials!');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed. Please try again.');
            }
        });
        
        // Add New Design
        addDesignBtn.addEventListener('click', () => {
            document.getElementById('adminModalTitle').textContent = 'Add New Design';
            document.getElementById('designId').value = '';
            document.getElementById('designTitle').value = '';
            document.getElementById('designDescription').value = '';
            designImageInput.value = '';
            fileInputLabel.textContent = 'Choose Image File';
            fileInputLabel.classList.remove('has-file');
            imagePreview.style.display = 'none';
            currentImageFile = null;
            uploadProgress.style.display = 'none';
            adminDesignModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
        
        // Save Design
        adminDesignForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const designId = document.getElementById('designId').value;
            const title = document.getElementById('designTitle').value;
            const description = document.getElementById('designDescription').value;
            
            if (!currentImageFile && !designId) {
                alert('Please select an image file');
                return;
            }
            
            const token = localStorage.getItem('adminToken');
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            
            if (currentImageFile) {
                formData.append('image', currentImageFile);
            }
            
            try {
                // Show upload progress
                uploadProgress.style.display = 'block';
                progressFill.style.width = '0%';
                progressText.textContent = 'Uploading...';
                
                let response;
                if (designId) {
                    // Update existing design - use POST with _method parameter
                    formData.append('_method', 'PUT');
                    response = await fetch(`${API_BASE_URL}/designs/${designId}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                } else {
                    // Create new design
                    response = await fetch(`${API_BASE_URL}/designs`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                }
                
                const data = await response.json();
                
                if (data.success) {
                    closeModal();
                    loadDesigns();
                    alert('Design saved successfully!');
                } else {
                    alert('Failed to save design. Please try again.');
                }
            } catch (error) {
                console.error('Save design error:', error);
                alert('Failed to save design. Please try again.');
            } finally {
                uploadProgress.style.display = 'none';
            }
        });
        
        // Load Designs from API
        async function loadDesigns() {
            try {
                const response = await fetch(`${API_BASE_URL}/designs`);
                const data = await response.json();
                
                if (data.success) {
                    designs = data.designs;
                    renderDesigns();
                } else {
                    console.error('Failed to load designs');
                }
            } catch (error) {
                console.error('Error loading designs:', error);
            }
        }
        
        // Render Designs
        function renderDesigns() {
            designGallery.innerHTML = '';
            
            if (designs.length === 0) {
                designGallery.innerHTML = '<p style="text-align: center; width: 100%;">No designs uploaded yet.</p>';
                return;
            }
            
            designs.forEach(design => {
                const designCard = document.createElement('div');
                designCard.className = 'design-card';
                designCard.innerHTML = `
                    <img src="${API_BASE_URL}/uploads/${design.image}" alt="${design.title}" class="design-img">
                    <div class="design-info">
                        <h3>${design.title}</h3>
                        <p>${design.description.substring(0, 100)}...</p>
                        ${isAdmin ? `
                        <div class="admin-controls">
                            <button class="edit-btn" data-id="${design.id}">Edit</button>
                            <button class="delete-btn" data-id="${design.id}">Delete</button>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                designCard.querySelector('.design-img').addEventListener('click', () => {
                    openDesignModal(design);
                });
                
                if (isAdmin) {
                    designCard.querySelector('.edit-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        editDesign(design.id);
                    });
                    
                    designCard.querySelector('.delete-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteDesign(design.id);
                    });
                }
                
                designGallery.appendChild(designCard);
            });
        }
        
        // Edit Design
        function editDesign(id) {
            const design = designs.find(d => d.id == id);
            
            if (design) {
                document.getElementById('adminModalTitle').textContent = 'Edit Design';
                document.getElementById('designId').value = design.id;
                document.getElementById('designTitle').value = design.title;
                document.getElementById('designDescription').value = design.description;
                designImageInput.value = '';
                fileInputLabel.textContent = 'Choose New Image (Optional)';
                fileInputLabel.classList.remove('has-file');
                imagePreview.src = `${API_BASE_URL}/uploads/${design.image}`;
                imagePreview.style.display = 'block';
                currentImageFile = null;
                uploadProgress.style.display = 'none';
                adminDesignModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }
        
        // Delete Design
        async function deleteDesign(id) {
            if (!confirm('Are you sure you want to delete this design?')) {
                return;
            }
            
            const token = localStorage.getItem('adminToken');
            
            try {
                const response = await fetch(`${API_BASE_URL}/designs/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    loadDesigns();
                    alert('Design deleted successfully!');
                } else {
                    alert('Failed to delete design. Please try again.');
                }
            } catch (error) {
                console.error('Delete design error:', error);
                alert('Failed to delete design. Please try again.');
            }
        }
        
        // Video Upload functionality
        addVideoBtn.addEventListener('click', () => {
            videoUploadModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });

        // Video upload form submission
        videoUploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('videoTitle').value;
            const description = document.getElementById('videoDescription').value;
            const uploadToYoutube = document.getElementById('uploadToYoutube').checked;
            const videoFile = document.getElementById('videoFile').files[0];
            
            if (!videoFile) {
                alert('Please select a video file');
                return;
            }
            
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('uploadToYoutube', uploadToYoutube.toString());
            formData.append('video', videoFile);
            
            const token = localStorage.getItem('adminToken');
            
            try {
                uploadVideoBtn.disabled = true;
                uploadVideoBtn.textContent = 'Uploading...';
                
                const response = await fetch(`${API_BASE_URL}/videos`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    closeModal();
                    loadVideos();
                    alert('Video uploaded successfully!' + (data.youtubeUrl ? ' Also uploaded to YouTube.' : ''));
                    videoUploadForm.reset();
                } else {
                    alert('Failed to upload video. Please try again.');
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Failed to upload video. Please try again.');
            } finally {
                uploadVideoBtn.disabled = false;
                uploadVideoBtn.textContent = 'Upload Video';
            }
        });

        // Load videos
        async function loadVideos() {
            try {
                const response = await fetch(`${API_BASE_URL}/videos`);
                const data = await response.json();
                
                if (data.success) {
                    videos = data.videos;
                    renderVideos();
                }
            } catch (error) {
                console.error('Error loading videos:', error);
            }
        }

        // Render videos
        function renderVideos() {
            videosGrid.innerHTML = '';
            
            if (videos.length === 0) {
                videosGrid.innerHTML = '<p style="text-align: center; width: 100%;">No videos uploaded yet.</p>';
                return;
            }
            
            videos.forEach(video => {
                const videoCard = document.createElement('div');
                videoCard.className = 'design-card';
                
                const videoContent = video.youtube_url ? 
                    `<div class="video-container">
                        <iframe 
                            width="100%" 
                            height="200" 
                            src="https://www.youtube.com/embed/${video.youtube_video_id}" 
                            frameborder="0" 
                            allowfullscreen>
                        </iframe>
                    </div>` :
                    `<div class="video-placeholder">
                        <i class="fas fa-video"></i>
                        <p>Video available for download</p>
                    </div>`;
                
                videoCard.innerHTML = `
                    ${videoContent}
                    <div class="design-info">
                        <h3>${video.title}</h3>
                        <p>${video.description.substring(0, 100)}...</p>
                        ${video.youtube_url ? `
                            <a href="${video.youtube_url}" target="_blank" class="btn" style="margin-top: 10px;">
                                <i class="fab fa-youtube"></i> Watch on YouTube
                            </a>
                        ` : ''}
                        ${isAdmin ? `
                        <div class="admin-controls">
                            <button class="delete-btn" data-video-id="${video.id}">Delete</button>
                        </div>
                        ` : ''}
                    </div>
                `;
                
                if (isAdmin) {
                    videoCard.querySelector('.delete-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteVideo(video.id);
                    });
                }
                
                videosGrid.appendChild(videoCard);
            });
        }

        // Delete video
        async function deleteVideo(id) {
            if (!confirm('Are you sure you want to delete this video?')) {
                return;
            }
            
            const token = localStorage.getItem('adminToken');
            
            try {
                const response = await fetch(`${API_BASE_URL}/videos/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    loadVideos();
                    alert('Video deleted successfully!');
                } else {
                    alert('Failed to delete video. Please try again.');
                }
            } catch (error) {
                console.error('Delete video error:', error);
                alert('Failed to delete video. Please try again.');
            }
        }
        
        // Check if admin is already logged in
        function checkAdminStatus() {
            const token = localStorage.getItem('adminToken');
            
            if (token) {
                // Verify token with backend
                fetch(`${API_BASE_URL}/admin/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        isAdmin = true;
                        addDesignBtnContainer.style.display = 'block';
                        addVideoBtnContainer.style.display = 'block';
                    } else {
                        localStorage.removeItem('adminToken');
                    }
                })
                .catch(error => {
                    console.error('Token verification error:', error);
                    localStorage.removeItem('adminToken');
                });
            }
        }
        
        // Initialize the page
        document.addEventListener('DOMContentLoaded', () => {
            checkAdminStatus();
            loadDesigns();
            loadVideos();
        });