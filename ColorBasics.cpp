//------------------------------------------------------------------------------
// <copyright file="ColorBasics.cpp" company="Microsoft">
//     Copyright (c) Microsoft Corporation.  All rights reserved.
// </copyright>
//------------------------------------------------------------------------------

#include "stdafx.h"
#include <strsafe.h>
#include "ColorBasics.h"
#include "resource.h"

#ifdef _DEBUG
#include <direct.h>
#endif
/// <summary>
/// Constructor
/// </summary>
CColorBasics::CColorBasics() :
    m_pD2DFactory(NULL),
    m_pDrawColor(NULL),
    m_hNextColorFrameEvent(INVALID_HANDLE_VALUE),
    m_pColorStreamHandle(INVALID_HANDLE_VALUE),
    m_hNextSkeletonEvent(INVALID_HANDLE_VALUE),
    m_pSkeletonStreamHandle(INVALID_HANDLE_VALUE),
    m_bSaveScreenshot(false),
    m_pNuiSensor(NULL)
{
}

/// <summary>
/// Destructor
/// </summary>
CColorBasics::~CColorBasics()
{
    if (m_pNuiSensor)
    {
        m_pNuiSensor->NuiShutdown();
    }

    if (m_hNextColorFrameEvent != INVALID_HANDLE_VALUE)
    {
        CloseHandle(m_hNextColorFrameEvent);
    }

    if (m_hNextSkeletonEvent && (m_hNextSkeletonEvent != INVALID_HANDLE_VALUE))
    {
        CloseHandle(m_hNextSkeletonEvent);
    }

    // clean up Direct2D renderer
    delete m_pDrawColor;
    m_pDrawColor = NULL;

    // clean up Direct2D
    SafeRelease(m_pD2DFactory);

    SafeRelease(m_pNuiSensor);
}

void CColorBasics::setDasher(DASHout *dash){
	dasher = dash;
}

/// <summary>
/// Creates the main window and begins processing
/// </summary>
/// <param name="hInstance">handle to the application instance</param>
/// <param name="nCmdShow">whether to display minimized, maximized, or normally</param>
int CColorBasics::Run(HINSTANCE hInstance, int nCmdShow, DASHout* dasher)
{
    MSG       msg = {0};
    WNDCLASS  wc;
	DWORD	event_res;

    // Dialog custom window class
    ZeroMemory(&wc, sizeof(wc));
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.cbWndExtra    = DLGWINDOWEXTRA;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon         = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_APP));
    wc.lpfnWndProc   = DefDlgProcW;
    wc.lpszClassName = "ColorBasicsAppDlgWndClass";

    if (!RegisterClass(&wc))
    {
        return 0;
    }

    // Create main application window
    HWND hWndApp = CreateDialogParam(
        hInstance,
        MAKEINTRESOURCE(IDD_APP),
        NULL,
        (DLGPROC)CColorBasics::MessageRouter, 
        reinterpret_cast<LPARAM>(this));

    // Show window
    ShowWindow(hWndApp, nCmdShow);

    const int eventCount = 2;
    HANDLE hEvents[eventCount];

#ifdef _DEBUG
		char cwd[1024];
		if (_getcwd(cwd, sizeof(cwd)) != NULL) fprintf(stdout, "Current working dir: %s\n", cwd);
		fprintf(stdout, "Checking Threader... ");
		if(dasher->threader->mutex == NULL){
			printErr("WARNING: thread initialization error\n");
		}else{
			fprintf(stdout, "OK\n");
		}
		if(dasher->colFrameCount==0)getchar();
#endif

    // Main message loop
    while (WM_QUIT != msg.message)
    {
        hEvents[0] = m_hNextColorFrameEvent;
		hEvents[1] = m_hNextSkeletonEvent;

        // Check to see if we have either a message (by passing in QS_ALLINPUT)
        // Or a Kinect event (hEvents)
        // Update() will check for Kinect events individually, in case more than one are signalled
		//more info on MsgWaitForMultipleObjects function: https://msdn.microsoft.com/en-us/library/windows/desktop/ms684242%28v=vs.85%29.aspx
        event_res = MsgWaitForMultipleObjects(eventCount, hEvents, FALSE, INFINITE, QS_ALLINPUT);

        // Explicitly check the Kinect frame event since MsgWaitForMultipleObjects
        // can return for other reasons even though it is signaled.
        if((0 <= event_res)&&(event_res < 2)) Update(dasher, event_res);

        while (PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE))
        {

#ifdef _DEBUG
			if(WM_KEYDOWN == msg.message)
				switch(msg.wParam){
				case(VK_SPACE):	//we have space
				case(0x50):		//or 'P'
					//system("PAUSE");
					printf("used for testing \n");
					break;
				}
#endif
            // If a dialog message will be taken care of by the dialog proc
            if ((hWndApp != NULL) && IsDialogMessageW(hWndApp, &msg))
            {
                continue;
            }

            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

	if(WM_QUIT == msg.message){
		if(dasher->segment_started){
			muxer_close_segment(dasher);
			if(dasher->skelFrameCount>0){
				printf("\n\n FINAL FLUSHING \n\n");		//TODOk remove
				flush_skeleton_coordinates(dasher->seg_num);
				dasher->video_done = true;	//TODOk check
			}
		}
		muxer_destroy(dasher);
		system("PAUSE");
	}

    return static_cast<int>(msg.wParam);
}

/// <summary>
/// Main processing function
/// </summary>
void CColorBasics::Update(DASHout* dasher, DWORD event_res)
{
	u64 timeref = 0;	//TODO fix/move this

    if (NULL == m_pNuiSensor)
    {
        return;
    }

    if ( WAIT_OBJECT_0 == WaitForSingleObject(m_hNextColorFrameEvent, INFINITE) )
    {
        ProcessColor(dasher);
    }

    if (event_res == 1 && WAIT_OBJECT_0 == WaitForSingleObject(m_hNextSkeletonEvent, INFINITE) )
    {
		//TODO add process skel function
		timeref = gf_sys_clock_high_res() - dasher->sys_start;
		ProcessSkeleton(dasher, timeref);
    }

	if(dasher->nextColourFrame){
		int res = muxer_encode(dasher, (u8 *) dasher->nextColourFrame->kinectFrame, dasher->nextColourFrame->size,dasher->nextColourFrame->pts);

		if((res>=0)&&(!dasher->segment_started)){
			res = muxer_open_segment(dasher, "x64/Debug/out", "seg", dasher->seg_num);
			timeref = gf_sys_clock_high_res() - dasher->sys_start;
			printf("\t\tOpening segment time : %llu\n", timeref);
		}

		if(res>=0){
			res = muxer_write_frame(dasher, dasher->colFrameCount);
			dasher->colFrameCount++;
		}

		if(res==1){
			res = muxer_close_segment(dasher);
			if(res==GF_OK){
				write_playlist_segment(dasher->seg_num, timeref);
			}
			if(dasher->skelFrameCount>0){
				printf("\n\n FLUSHING \n\n");	//TODOk remove
				res = flush_skeleton_coordinates(dasher->seg_num);
				if(res == false){
					printf("\n\n\n\nFLUSHING ERROR\n\n");
				}
			}
			dasher->seg_num++;
		}

		dasher->nextColourFrame = NULL;
	}

}

/// <summary>
/// Handles window messages, passes most to the class instance to handle
/// </summary>
/// <param name="hWnd">window message is for</param>
/// <param name="uMsg">message</param>
/// <param name="wParam">message data</param>
/// <param name="lParam">additional message data</param>
/// <returns>result of message processing</returns>
LRESULT CALLBACK CColorBasics::MessageRouter(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
{
    CColorBasics* pThis = NULL;
    
    if (WM_INITDIALOG == uMsg)
    {
        pThis = reinterpret_cast<CColorBasics*>(lParam);
        SetWindowLongPtr(hWnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(pThis));
    }
    else
    {
        pThis = reinterpret_cast<CColorBasics*>(::GetWindowLongPtr(hWnd, GWLP_USERDATA));
    }

    if (pThis)
    {
        return pThis->DlgProc(hWnd, uMsg, wParam, lParam);
    }

    return 0;
}

/// <summary>
/// Handle windows messages for the class instance
/// </summary>
/// <param name="hWnd">window message is for</param>
/// <param name="uMsg">message</param>
/// <param name="wParam">message data</param>
/// <param name="lParam">additional message data</param>
/// <returns>result of message processing</returns>
LRESULT CALLBACK CColorBasics::DlgProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
        case WM_INITDIALOG:
        {
            // Bind application window handle
            m_hWnd = hWnd;

            // Init Direct2D
            D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, &m_pD2DFactory);

            // Create and initialize a new Direct2D image renderer (take a look at ImageRenderer.h)
            // We'll use this to draw the data we receive from the Kinect to the screen
            m_pDrawColor = new ImageRenderer();
            HRESULT hr = m_pDrawColor->Initialize(GetDlgItem(m_hWnd, IDC_VIDEOVIEW), m_pD2DFactory, cColorWidth, cColorHeight, cColorWidth * sizeof(long));
            if (FAILED(hr))
            {
                SetStatusMessage(L"Failed to initialize the Direct2D draw device.");
            }

            // Look for a connected Kinect, and create it if found
            CreateFirstConnected();
        }
        break;

        // If the titlebar X is clicked, destroy app
        case WM_CLOSE:
            DestroyWindow(hWnd);
            break;

        case WM_DESTROY:
            // Quit the main message pump
            PostQuitMessage(0);
            break;

        // Handle button press
        case WM_COMMAND:
            // If it was for the screenshot control and a button clicked event, save a screenshot next frame 
            if (IDC_BUTTON_SCREENSHOT == LOWORD(wParam) && BN_CLICKED == HIWORD(wParam))
            {
                m_bSaveScreenshot = true;
            }
            break;
    }

    return FALSE;
}

/// <summary>
/// Create the first connected Kinect found 
/// </summary>
/// <returns>indicates success or failure</returns>
HRESULT CColorBasics::CreateFirstConnected()
{
    INuiSensor * pNuiSensor;
    HRESULT hr;

    int iSensorCount = 0;
    hr = NuiGetSensorCount(&iSensorCount);
    if (FAILED(hr))
    {
        return hr;
    }

    // Look at each Kinect sensor
    for (int i = 0; i < iSensorCount; ++i)
    {
        // Create the sensor so we can check status, if we can't create it, move on to the next
        hr = NuiCreateSensorByIndex(i, &pNuiSensor);
        if (FAILED(hr))
        {
            continue;
        }

        // Get the status of the sensor, and if connected, then we can initialize it
        hr = pNuiSensor->NuiStatus();
        if (S_OK == hr)
        {
            m_pNuiSensor = pNuiSensor;
            break;
        }

        // This sensor wasn't OK, so release it since we're not using it
        pNuiSensor->Release();
    }

    if (NULL != m_pNuiSensor)
    {
        // Initialize the Kinect and specify that we'll be using color
        hr = m_pNuiSensor->NuiInitialize(NUI_INITIALIZE_FLAG_USES_COLOR | NUI_INITIALIZE_FLAG_USES_SKELETON); 
        if (SUCCEEDED(hr))
        {
            // Create an event that will be signaled when color data is available
            m_hNextColorFrameEvent = CreateEvent(NULL, TRUE, FALSE, NULL);

            // Create an event that will be signaled when skeleton data is available
            m_hNextSkeletonEvent = CreateEventW(NULL, TRUE, FALSE, NULL);

            // Open a color image stream to receive color frames
			//TODO: Check image format https://msdn.microsoft.com/en-us/library/nuiimagecamera.nui_image_type.aspx (we now have RGB) 
            hr = m_pNuiSensor->NuiImageStreamOpen(
                NUI_IMAGE_TYPE_COLOR,
                NUI_IMAGE_RESOLUTION_640x480,
                0,
                2,
                m_hNextColorFrameEvent,
                &m_pColorStreamHandle);

			if(!FAILED(hr)){
				// Open a skeleton stream to receive skeleton data
				hr = m_pNuiSensor->NuiSkeletonTrackingEnable(m_hNextSkeletonEvent, 0);
			}

        }
    }

    if (NULL == m_pNuiSensor || FAILED(hr))
    {
        SetStatusMessage(L"No ready Kinect found!");
        return E_FAIL;
    }

    return hr;
}

/// <summary>
/// Get the name of the file where screenshot will be stored.
/// </summary>
/// <param name="screenshotName">
/// [out] String buffer that will receive screenshot file name.
/// </param>
/// <param name="screenshotNameSize">
/// [in] Number of characters in screenshotName string buffer.
/// </param>
/// <returns>
/// S_OK on success, otherwise failure code.
/// </returns>
HRESULT GetScreenshotFileName(wchar_t *screenshotName, UINT screenshotNameSize)
{
    wchar_t *knownPath = NULL;
    HRESULT hr = SHGetKnownFolderPath(FOLDERID_Pictures, 0, NULL, &knownPath);

    if (SUCCEEDED(hr))
    {
        // Get the time
        wchar_t timeString[MAX_PATH];
        GetTimeFormatEx(NULL, 0, NULL, L"hh'-'mm'-'ss", timeString, _countof(timeString));

        // File name will be KinectSnapshot-HH-MM-SS.wav
        StringCchPrintfW(screenshotName, screenshotNameSize, L"%s\\KinectSnapshot-%s.bmp", knownPath, timeString);
    }

    CoTaskMemFree(knownPath);
    return hr;
}

/// <summary>
/// Handle new color data
/// </summary>
/// <returns>indicates success or failure</returns>
void CColorBasics::ProcessColor(DASHout* dasher)
{
    HRESULT hr;
    NUI_IMAGE_FRAME imageFrame;
	colourFrame *cFrame;

    // Attempt to get the color frame
    hr = m_pNuiSensor->NuiImageStreamGetNextFrame(m_pColorStreamHandle, 0, &imageFrame);
    if (FAILED(hr))
    {
		printf("failed in processcolor \n ");
        return;
    }

    INuiFrameTexture * pTexture = imageFrame.pFrameTexture;
    NUI_LOCKED_RECT LockedRect;

    // Lock the frame data so the Kinect knows not to modify it while we're reading it
    pTexture->LockRect(0, &LockedRect, NULL, 0);

    // Make sure we've received valid data
    if (LockedRect.Pitch != 0)
    {

		//init the frame to be parsed in FFMPEG
		cFrame = init_cFrame(cColorWidth*cColorHeight*3);
		if(!cFrame){
			printf("fudge!\n");
			gf_free(cFrame);
			return;
		}

		//Frame number
		cFrame->number = imageFrame.dwFrameNumber;
		if (!dasher->sys_start) {
			dasher->sys_start = gf_sys_clock_high_res();
			dasher->prev_pts = 0;
			cFrame->pts = 0;
		} else {	
			//TODO: fix timing here and
			cFrame->pts = 30*(gf_sys_clock_high_res() - dasher->sys_start)/1000000;
			printf("CTS diff is %d ms\n", (u32) (cFrame->pts - dasher->prev_pts) / 1000);
			dasher->prev_pts = cFrame->pts;
		}
		//convert RGBA to RGB
		unsigned char * currFrame = (unsigned char *)LockedRect.pBits;

		int j = 0;
		for (int i = 0; i < cColorWidth * cColorHeight * 4; i += 4){
			(cFrame->kinectFrame)[i - j] = currFrame[i + 2];
			(cFrame->kinectFrame)[i - j + 1] = currFrame[i + 1];
			(cFrame->kinectFrame)[i - j + 2] = currFrame[i];
			j++;
		}

		dasher->nextColourFrame = cFrame;



        // Draw the data with Direct2D
        m_pDrawColor->Draw(static_cast<BYTE *>(LockedRect.pBits), LockedRect.size);

#if 0
		// If the user pressed the screenshot button, save a screenshot
        if (m_bSaveScreenshot)
        {
            WCHAR statusMessage[cStatusMessageMaxLen];

            // Retrieve the path to My Photos
            WCHAR screenshotPath[MAX_PATH];
            GetScreenshotFileName(screenshotPath, _countof(screenshotPath));

            // Write out the bitmap to disk
            hr = SaveBitmapToFile(static_cast<BYTE *>(LockedRect.pBits), cColorWidth, cColorHeight, 32, screenshotPath);

            if (SUCCEEDED(hr))
            {
                // Set the status bar to show where the screenshot was saved
                StringCchPrintf( statusMessage, cStatusMessageMaxLen, L"Screenshot saved to %s", screenshotPath);
            }
            else
            {
                StringCchPrintf( statusMessage, cStatusMessageMaxLen, L"Failed to write screenshot to %s", screenshotPath);
            }

            SetStatusMessage(statusMessage);

            // toggle off so we don't save a screenshot again next frame
            m_bSaveScreenshot = false;
        }
#endif
	}

    // We're done with the texture so unlock it
    pTexture->UnlockRect(0);

    // Release the frame
    m_pNuiSensor->NuiImageStreamReleaseFrame(m_pColorStreamHandle, &imageFrame);
}

void CColorBasics::ProcessSkeleton(DASHout* dasher, u64 timeref){

	putchar('\n');
    NUI_SKELETON_FRAME skeletonFrame = {0};

    HRESULT hr = m_pNuiSensor->NuiSkeletonGetNextFrame(0, &skeletonFrame);

	skeletalData skeletonToThread;
	DWORD threadId;

    if ( FAILED(hr) )
    {
        return;
    }

    // smooth out the skeleton data
    m_pNuiSensor->NuiTransformSmooth(&skeletonFrame, NULL);

    for (int i = 0 ; i < NUI_SKELETON_COUNT; ++i)
    {
        NUI_SKELETON_TRACKING_STATE trackingState = skeletonFrame.SkeletonData[i].eTrackingState;

        if (NUI_SKELETON_TRACKED == trackingState)
        {
			//dasher->skelFrameCount = write_playlist_skeleton(skeletonFrame, i, dasher->skelFrameCount, timeref);
			dasher->skelFrameCount = push_skeleton_coordinates(skeletonFrame, i, dasher->skelFrameCount, timeref, dasher->seg_num);


			skeletonToThread.skel =skeletonFrame;
			skeletonToThread.index = i;
			skeletonToThread.skel_num = dasher->skelFrameCount;
			skeletonToThread.timeref = timeref;
			skeletonToThread.seg_num = dasher->seg_num;
			skeletonToThread.dasher = dasher;
			skeletonToThread.threader = dasher->threader;

			//TODOk check from HERE
			printf("sendin'  %d %u %u %u \n",skeletonFrame, i, dasher->skelFrameCount, timeref, dasher->seg_num);
			if(dasher->threader != NULL)
				printf("and it aint null\n");
			if(!(dasher->skelFrameCount>0))
				printf("but the skelly's wrong\n");

			/*
			memcpy(&skeletonToThread.skel, &skeletonFrame, sizeof(skeletonFrame));
			memcpy(&skeletonToThread.index, &i, sizeof(int));
			memcpy(&skeletonToThread.skel_num, &dasher->skelFrameCount, sizeof(u64));
			memcpy(&skeletonToThread.timeref, &timeref, sizeof(u64));
			memcpy(&skeletonToThread.seg_num, &dasher->seg_num, sizeof(u64));
			*/

			//TODOk check to HERE

			HANDLE hThread = CreateThread(0,0, (LPTHREAD_START_ROUTINE) generate_projected_coords, &skeletonToThread,0,&threadId);

			if(hThread != NULL) dasher->threader->threadcount++;

			printf("\n tracked %d, %d \n", skeletonFrame.SkeletonData[i].dwTrackingID, i);
			return;	//we assume only one skeleton

            // We're tracking the skeleton, draw it
//            DrawSkeleton(skeletonFrame.SkeletonData[i], width, height);
        }
        else if (NUI_SKELETON_POSITION_ONLY == trackingState)
        {
            // we've only received the center point of the skeleton (not the coords)
			// we do not care about this now
        }
    }


}

/// <summary>
/// Set the status bar message
/// </summary>
/// <param name="szMessage">message to display</param>
void CColorBasics::SetStatusMessage(WCHAR * szMessage)
{
    SendDlgItemMessageW(m_hWnd, IDC_STATUS, WM_SETTEXT, 0, (LPARAM)szMessage);
}

#if 0
/// <summary>
/// Save passed in image data to disk as a bitmap
/// </summary>
/// <param name="pBitmapBits">image data to save</param>
/// <param name="lWidth">width (in pixels) of input image data</param>
/// <param name="lHeight">height (in pixels) of input image data</param>
/// <param name="wBitsPerPixel">bits per pixel of image data</param>
/// <param name="lpszFilePath">full file path to output bitmap to</param>
/// <returns>indicates success or failure</returns>
HRESULT CColorBasics::SaveBitmapToFile(BYTE* pBitmapBits, LONG lWidth, LONG lHeight, WORD wBitsPerPixel, LPCWSTR lpszFilePath)
{
    DWORD dwByteCount = lWidth * lHeight * (wBitsPerPixel / 8);

    BITMAPINFOHEADER bmpInfoHeader = {0};

    bmpInfoHeader.biSize        = sizeof(BITMAPINFOHEADER);  // Size of the header
    bmpInfoHeader.biBitCount    = wBitsPerPixel;             // Bit count
    bmpInfoHeader.biCompression = BI_RGB;                    // Standard RGB, no compression
    bmpInfoHeader.biWidth       = lWidth;                    // Width in pixels
    bmpInfoHeader.biHeight      = -lHeight;                  // Height in pixels, negative indicates it's stored right-side-up
    bmpInfoHeader.biPlanes      = 1;                         // Default
    bmpInfoHeader.biSizeImage   = dwByteCount;               // Image size in bytes

    BITMAPFILEHEADER bfh = {0};

    bfh.bfType    = 0x4D42;                                           // 'M''B', indicates bitmap
    bfh.bfOffBits = bmpInfoHeader.biSize + sizeof(BITMAPFILEHEADER);  // Offset to the start of pixel data
    bfh.bfSize    = bfh.bfOffBits + bmpInfoHeader.biSizeImage;        // Size of image + headers

    // Create the file on disk to write to
    HANDLE hFile = CreateFileW(lpszFilePath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);

    // Return if error opening file
    if (NULL == hFile) 
    {
        return E_ACCESSDENIED;
    }

    DWORD dwBytesWritten = 0;
    
    // Write the bitmap file header
    if ( !WriteFile(hFile, &bfh, sizeof(bfh), &dwBytesWritten, NULL) )
    {
        CloseHandle(hFile);
        return E_FAIL;
    }
    
    // Write the bitmap info header
    if ( !WriteFile(hFile, &bmpInfoHeader, sizeof(bmpInfoHeader), &dwBytesWritten, NULL) )
    {
        CloseHandle(hFile);
        return E_FAIL;
    }
    
    // Write the RGB Data
    if ( !WriteFile(hFile, pBitmapBits, bmpInfoHeader.biSizeImage, &dwBytesWritten, NULL) )
    {
        CloseHandle(hFile);
        return E_FAIL;
    }    

    // Close the file
    CloseHandle(hFile);
    return S_OK;
}
#endif