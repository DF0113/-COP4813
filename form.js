const contactForm = document.getElementById("contact-form");
const confirmationForm = document.getElementById("confirmation-form");

function formatPhoneNumber(value) {
    const numbers = value.replace(/\D/g, "").slice(0, 10);

    if (numbers.length < 4) {
        return numbers.length ? `(${numbers}` : "";
    }

    if (numbers.length < 7) {
        return `(${numbers.slice(0, 3)})${numbers.slice(3)}`;
    }

    return `(${numbers.slice(0, 3)})${numbers.slice(3, 6)}-${numbers.slice(6)}`;
}

function checkBirthdate() {
    const birthdate = document.getElementById("birthdate");
    const date = new Date(`${birthdate.value}T00:00:00`);
    const today = new Date();
    const oldestDate = new Date();

    oldestDate.setFullYear(today.getFullYear() - 120);
    birthdate.setCustomValidity("");

    if (birthdate.value && date > today) {
        birthdate.setCustomValidity("Birth date cannot be in the future.");
    } else if (birthdate.value && date < oldestDate) {
        birthdate.setCustomValidity("Please enter a reasonable birth date.");
    }
}

function saveFormData() {
    const state = document.getElementById("state");
    const data = {
        firstName: document.getElementById("first-name").value.trim(),
        lastName: document.getElementById("last-name").value.trim(),
        address: document.getElementById("address").value.trim(),
        city: document.getElementById("city").value.trim(),
        state: state.value,
        stateName: state.options[state.selectedIndex].text,
        zip: document.getElementById("zip").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        birthdate: document.getElementById("birthdate").value,
        message: document.getElementById("message").value.trim()
    };

    sessionStorage.setItem("contactFormData", JSON.stringify(data));
}

function showConfirmation() {
    const savedData = sessionStorage.getItem("contactFormData");
    const error = document.getElementById("confirmation-error");

    if (!savedData) {
        error.textContent = "No form information was found. Please complete the form first.";
        document.getElementById("confirmation-details").hidden = true;
        document.getElementById("confirmation-form").hidden = true;
        return;
    }

    const data = JSON.parse(savedData);
    const fullAddress = `${data.address}, ${data.city}, ${data.state} ${data.zip}`;
    const emailText = `Name: ${data.firstName} ${data.lastName}\nAddress: ${fullAddress}\nPhone: ${data.phone}\nEmail: ${data.email}\nBirth Date: ${data.birthdate}\nMessage: ${data.message}`;

    document.getElementById("confirm-name").textContent = `${data.firstName} ${data.lastName}`;
    document.getElementById("confirm-address").textContent = fullAddress;
    document.getElementById("confirm-phone").textContent = data.phone;
    document.getElementById("confirm-email").textContent = data.email;
    document.getElementById("confirm-birthdate").textContent = data.birthdate;
    document.getElementById("confirm-message").textContent = data.message;
    document.getElementById("email-body").value = emailText;
}

if (contactForm) {
    const phone = document.getElementById("phone");
    const birthdate = document.getElementById("birthdate");
    const formError = document.getElementById("form-error");

    phone.addEventListener("input", function () {
        phone.value = formatPhoneNumber(phone.value);
    });

    birthdate.addEventListener("change", checkBirthdate);

    contactForm.addEventListener("submit", function (event) {
        checkBirthdate();
        formError.textContent = "";

        if (!contactForm.checkValidity()) {
            event.preventDefault();
            formError.textContent = "Please correct the highlighted fields before continuing.";
            contactForm.reportValidity();
            return;
        }

        event.preventDefault();
        saveFormData();
        window.location.href = "confirmation.html";
    });
}

if (confirmationForm) {
    showConfirmation();
}
