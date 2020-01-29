
export default function uploadFile(callback?: (result: any) => void) {
    var upload = document.createElement('INPUT');
    upload.setAttribute("type", "file");
    upload.setAttribute("id", "upload");
    upload.style.display = "none";
    upload.addEventListener("change", function (e) {
        var reader = new FileReader();
        reader.onload = function (event) {
            callback(event.target.result.toString());
        }
        reader.readAsText(e.target["files"][0]);
        document.body.removeChild(document.getElementById("upload"));
    })
    document.body.appendChild(upload);
    upload.click();
}