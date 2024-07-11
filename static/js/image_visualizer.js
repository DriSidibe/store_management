function previewImage() {
    var input = document.querySelector('input[type="file"]');
    input.addEventListener('change', function(){
        var file = input.files[0];
        var reader = new FileReader();
        reader.onload = function(e){
            var img = document.querySelector('#imagePreview');
            img.src = e.target.result;
            img.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
}