from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from bot_utils import send_certificate

fastapi_app = FastAPI()

# Add CORS middleware with specific origins and headers for rate limiting
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",  # Local development
        "http://127.0.0.1:5500",  # Local development
        "https://kwts30.github.io",  # GitHub Pages domain
        "https://kwts30.github.io/DOJ_Auto-FIllup_System/",  # Your specific GitHub Pages URL
        "https://kwts30.github.io/DOJ_Auto-FIllup_System"  # Without trailing slash
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
)

# Add a health check endpoint
@fastapi_app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@fastapi_app.post("/api/birth-certificate/preview")
async def birth_cert_preview(image: UploadFile):
    # Simply return a success response for the preview endpoint
    return JSONResponse({"message": "Preview received successfully!"})

@fastapi_app.post("/api/birth-certificate/submit")
async def birth_cert_submit(
    image: UploadFile,
    name_first: str = Form(...),
    name_middle: str = Form(...),
    name_last: str = Form(...),
    birth_state: str = Form(...),
    birth_city: str = Form(...),
    state_file_num: str = Form(...),
    local_reg_num: str = Form(...)
):
    try:
        # Read the image bytes
        img_bytes = await image.read()

        # Construct the child full name
        child_full_name = f"{name_first}_{name_middle}_{name_last}"

        # Send the image to Discord with certificate numbers
        sent = await send_certificate(
            img_bytes,
            child_full_name,
            birth_state,
            birth_city,
            state_file_num,
            local_reg_num,
            certificate_type="birth"
        )

        if sent:
            return JSONResponse({"message": "Birth certificate sent to Discord!"})
        else:
            return JSONResponse(
                {
                    "message": "Failed to send to Discord. Please try again in a few moments.",
                    "error": "RATE_LIMIT"
                }, 
                status_code=429
            )
    except Exception as e:
        return JSONResponse(
            {
                "message": f"An error occurred: {str(e)}",
                "error": "SERVER_ERROR"
            }, 
            status_code=500
        )

@fastapi_app.post("/api/marriage-certificate/submit")
async def marriage_cert_submit(
    image: UploadFile,
    groom_first: str = Form(...),
    groom_middle: str = Form(...),
    groom_last: str = Form(...),
    bride_first: str = Form(...),
    bride_middle: str = Form(...),
    bride_last: str = Form(...),
    marriage_state: str = Form(...),
    marriage_city: str = Form(...),
    state_file_num: str = Form(...),
    local_reg_num: str = Form(...)
):
    # Read the image bytes
    img_bytes = await image.read()

    # Construct the couple's full names
    couple_names = f"{groom_first}_{groom_last}_and_{bride_first}_{bride_last}"

    # Send the image to Discord with certificate numbers
    sent = await send_certificate(
        img_bytes,
        couple_names,
        marriage_state,
        marriage_city,
        state_file_num,
        local_reg_num,
        certificate_type="marriage"
    )

    if sent:
        return JSONResponse({"message": "Marriage certificate sent to Discord!"})
    else:
        return JSONResponse({"message": "Failed to send to Discord."}, status_code=500)

@fastapi_app.post("/api/business-permit/submit")
async def business_permit_submit(
    image: UploadFile,
    business_name: str = Form(...),
    owner_name: str = Form(...),
    business_state: str = Form(...),
    business_city: str = Form(...),
    permit_number: str = Form(""),
    local_reg_num: str = Form("")
):
    try:
        img_bytes = await image.read()
        display_name = f"{business_name}_owned_by_{owner_name}".replace(" ", "_")
        sent = await send_certificate(
            img_bytes,
            display_name,
            business_state,
            business_city,
            permit_number,
            local_reg_num,
            certificate_type="business"
        )
        if sent:
            return JSONResponse({"message": "Business permit sent to Discord!"})
        else:
            return JSONResponse({"message": "Failed to send to Discord."}, status_code=500)
    except Exception as e:
        return JSONResponse({"message": f"An error occurred: {str(e)}"}, status_code=500)

if __name__ == "__main__":
    # Allow direct execution: python app.py
    import uvicorn
    uvicorn.run("app:fastapi_app", host="127.0.0.1", port=8000, reload=True)