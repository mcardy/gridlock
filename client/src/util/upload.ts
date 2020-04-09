/**
 * A utility function to request a file from the user
 * @param callback A callback for when the file is loaded.
 */
export default function uploadFile(callback?: (result: any, name?: string) => void) {
    var upload = document.createElement('INPUT');
    upload.setAttribute("type", "file");
    upload.setAttribute("id", "upload");
    upload.style.display = "none";
    upload.addEventListener("change", function (e) {
        var reader = new FileReader();
        var name = e.target["files"][0].name;
        reader.onload = function (event) {
            callback(event.target.result.toString(), name);
        }
        reader.readAsText(e.target["files"][0]);
        document.body.removeChild(document.getElementById("upload"));
    })
    document.body.appendChild(upload);
    upload.click();
}