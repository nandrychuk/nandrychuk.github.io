window.backgroundGenerator(true);
// Select all elements with the class 'expandable'
const expandableDivs = document.querySelectorAll(".rectangle");

// Loop through each element and attach the click event listener
expandableDivs.forEach(function(div) {
  div.addEventListener("click", function() {
    this.classList.toggle("rectangle-expanded"); // Toggle the "expanded" class on click

    // Check if the div has been expanded
    if (this.classList.contains("rectangle-expanded")) {
      // Modify the content inside the div when expanded
      let content = "";
      if (this.id === "DGE") {
        content = `
          <img src="Styling/Dal Games Expo Logo.png" alt="Dal Games Logo" class="image" />
          <div class="content"><p class="ubuntu-regular">The Dal Games Expo is an annual student run event with 600+ attendees last year. I am the main founder and website manager, I built this website in carrd.co to easily make many webpages and utilize their server hosting.</p>
          <div class="linkAndGit"><a href="https://www.dalgamesexpo.ca" target="_blank" rel="noopener noreferrer">Take a Look</a></div></div>`;
      } else if (this.id === "GSS") {
        content  = `
          <img src="Styling/Clown.png" alt="Clown" class="image" />
          <div class="content"><p class="ubuntu-regular">I made this tool for a streamer, Atrioc, to make it easier to track videos suggested by viewers for his weekly series, Get Smarter Saturday. Made entirely in Javascript, HTML, and CSS. To understand the background you kind of need to be a fan of Atrioc already.</p>
          <div class="linkAndGit"><a href="Atrioc/GSSTool.html" target="_blank" rel="noopener noreferrer">Take a Look</a>
          <a href="https://github.com/nandrychuk/AtriocGetSmarter" target="_blank" rel="noopener noreferrer"><img class="smallLogo" src="../Styling/github-mark.svg"></a></div></div>`;
      } else if (this.id === "TP") {
        content = `
          <img src="../Styling/MagentaBean.svg" alt="Abstract image" class="image" />
          <div class="content"><p class="ubuntu-regular">This Portfolio was entirely written in JavaScript, CSS, and HTML without the use of external tools or libraries. Purple and yellow may not be for everyone but as you can see from my utilization in this and other projects, I love them.</p>
          <div class="linkAndGit"><a href="https://nandrychuk.github.io/" target="_blank" rel="noopener noreferrer">Take a Look</a>
          <a href="https://github.com/nandrychuk/nandrychuk.github.io" target="_blank" rel="noopener noreferrer"><img class="smallLogo" src="../Styling/github-mark.svg"></a></div>`;
      }
      this.innerHTML = content;

    } else {
      // Reset the content when collapsed
      if (this.id === "DGE") {
        this.innerHTML = `<p class="ubuntu-medium">Dal Games Expo</p>`;
      } else if (this.id === "GSS") {
        this.innerHTML = `<p class="ubuntu-medium">Get Smarter Saturday</p>`;
      } else if (this.id === "TP") {
        this.innerHTML = `<p class="ubuntu-medium">This Portfolio</p>`;
      }
    }
  });
});
