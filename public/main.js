// Honestly... I have no idea if this is necessary or if it works.
// The idea is to move a line across the screen to try to prevent screen burn.
// I feel like it"s better than nothing.
// Plus, I notice it grabs my attention more. And it"s kind of purrrty.

document.addEventListener("DOMContentLoaded", ready);

function ready() {
    const burnGuard = document.querySelector("#burnGuard");
    const colors = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#073b4c", "#2b2d42", "#8d99ae", "#edf2f4", "#ef233c"];
    const delay = 12000;
    const windowWidth = window.innerWidth - 20; // stop a little short, looks nicer
    let color = 0;
    let id = 0;

    function moveLine(elem) {
        let left = 0;

        if (color === colors.length) {
            color = 0;
        } else {
            color = ++color;
        }

        burnGuard.style.left = "left: 0px";
        burnGuard.style.background = colors[color];
        burnGuard.style.display = "block";

        function frame() {
            left++;
            burnGuard.style.left = left + "px";

            if (left === windowWidth) {
                clearInterval(id);
                burnGuard.style.display = "none";
                setTimeout(moveLine, delay);
            }
        }

        // Add a slight delay
        id = setInterval(frame, 1);
    }

    setTimeout(moveLine, delay);

    if (!document.querySelector("#calories").getAttribute("calories") && !document.querySelector("#carbs").getAttribute("carbs")) {
        document.querySelector(".cals").style = "display: none;"
        document.querySelector(".carbs").style = "display: none;"
        document.querySelector(".fetching").style = "display: block;"
        setTimeout(function () {
            window.location.reload();
        }, 20000);
    }
}