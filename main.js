
class ProjectCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                :host {
                    display: block;
                    background-color: var(--card-background, #2b2b2b);
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                :host(:hover) {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                }
                img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                }
                .card-content {
                    padding: 1rem;
                }
                h3 {
                    margin: 0 0 0.5rem 0;
                    color: var(--text-color, #f0f0f0);
                }
                p {
                    margin: 0;
                    color: #aaa;
                }
            </style>
            <img src="${this.getAttribute('image') || 'https://via.placeholder.com/300x200'}" alt="Project Image">
            <div class="card-content">
                <h3>${this.getAttribute('title') || 'Project Title'}</h3>
                <p>${this.getAttribute('description') || 'Project Description'}</p>
            </div>
        `;

        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }
}

customElements.define('project-card', ProjectCard);

const communityGrid = document.querySelector('.community-grid');

const projects = [
    {
        title: 'Project One',
        description: 'A cool project by a community member.',
        image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        title: 'Project Two',
        description: 'Another amazing creation from the hub.',
        image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1964&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        title: 'Project Three',
        description: 'Showcasing the power of collaboration.',
        image: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        title: 'Project Four',
        description: 'Innovation at its finest.',
        image: 'https://images.unsplash.com/photo-1555774698-0b77e0abfe79?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
        {
        title: 'Project Five',
        description: 'A beautiful design from a talented artist.',
        image: 'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=2072&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    },
    {
        title: 'Project Six',
        description: 'Exploring new technologies.',
        image: 'https://images.unsplash.com/photo-1605810230464-38c5b4637060?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    }
];

projects.forEach(project => {
    const projectCard = document.createElement('project-card');
    projectCard.setAttribute('title', project.title);
    projectCard.setAttribute('description', project.description);
    projectCard.setAttribute('image', project.image);
    communityGrid.appendChild(projectCard);
});
