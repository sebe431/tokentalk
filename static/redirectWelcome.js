if(!localStorage.getItem('agreedToTokentalkTAC_V1') || localStorage.getItem('agreedToTokentalkTAC_V1') != 'true') {
    console.log('user has not agreed to updated terms and conditions');
    window.location = "welcome/";
}