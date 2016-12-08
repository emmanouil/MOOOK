# MOOOK

---
## Branches
### master
Currently active master; contains experiments with extended AV streams

### kinect-audio
Inactive master; code used for *Streaming of Kinect Data for Interactive Audio Applications*

---
## Output
Everything is put in `out` folder, which includes:
- Video with an init and 1s-long segments
- Files with coordinates for this segment (spatial and projected)
- A playlist referencing the video and coord files 

### Coordinates format
`T:τ`timestamp(in ms)  
`A:x,y,z`"centre" coordinates  
`n:x,y,z` *where index `n` ∈ [0,19]* Joint Coordinate  
index reference [example](#coordinate-index-and-enum) and coordinate set [example](#coordinate-entry-example)


## Options
Options are set by defining a preprocessor variable macro with value 1 (i.e. `#define THIS_IS_ON 1`)  
  **NOTES:**  
To be sure that an option is deactivated use `#undef`  
Each option should be set/unset at its respective header file  
### Options in `Tools.h`  
- `USE_SERVICE` - Not implemented

### Options in `Main.cpp`
All encoding options are set in variables inside `Main.cpp` __for now__


## Annex
### Coordinate Index (and enum)
    NUI_SKELETON_POSITION_HIP_CENTER : 0,
    NUI_SKELETON_POSITION_SPINE : 1,
    NUI_SKELETON_POSITION_SHOULDER_CENTER : 2,
    NUI_SKELETON_POSITION_HEAD : 3,
    NUI_SKELETON_POSITION_SHOULDER_LEFT : 4,
    NUI_SKELETON_POSITION_ELBOW_LEFT : 5,
    NUI_SKELETON_POSITION_WRIST_LEFT : 6,
    NUI_SKELETON_POSITION_HAND_LEFT : 7,
    NUI_SKELETON_POSITION_SHOULDER_RIGHT : 8,
    NUI_SKELETON_POSITION_ELBOW_RIGHT : 9,
    NUI_SKELETON_POSITION_WRIST_RIGHT : 10,
    NUI_SKELETON_POSITION_HAND_RIGHT : 11,
    NUI_SKELETON_POSITION_HIP_LEFT : 12,
    NUI_SKELETON_POSITION_KNEE_LEFT : 13,
    NUI_SKELETON_POSITION_ANKLE_LEFT : 14,
    NUI_SKELETON_POSITION_FOOT_LEFT : 15,
    NUI_SKELETON_POSITION_HIP_RIGHT : 16,
    NUI_SKELETON_POSITION_KNEE_RIGHT : 17,
    NUI_SKELETON_POSITION_ANKLE_RIGHT : 18,
    NUI_SKELETON_POSITION_FOOT_RIGHT : 19
### Coordinate entry example
#### Raw
`T:4542 A:0.0103097,0.092336,2.32413 0:0.0112536,0.2979,2.40354 1:0.0213734,0.36907,2.44919 2:0.0257358,0.752418,2.43409 3:-0.00814651,0.94194,2.32035 4:-0.140039,0.6729,2.50291 5:-0.191736,0.394673,2.5128 6:-0.232179,0.177953,2.41051 7:-0.240909,0.078246,2.36053 8:0.193445,0.661755,2.44184 9:0.296573,0.396263,2.48413 10:0.339128,0.164406,2.35001 11:0.336094,0.0699649,2.31636 12:-0.0666484,0.224374,2.40671 13:-0.143956,-0.329041,2.35673 14:-0.180217,-0.736658,2.39007 15:-0.207889,-0.801028,2.34326 16:0.0850265,0.221579,2.3868 17:0.122709,-0.350963,2.44201 18:0.118881,-0.760212,2.45635 19:0.133839,-0.810782,2.37594`
#### Projected
`T:4542 A:161,109,18592 0:161,85,19224 1:162,77,19592 2:163,32,19472 3:159,4,18560 4:144,43,20016 5:138,75,20096 6:132,99,19280 7:131,111,18880 8:183,43,19528 9:194,74,19872 10:201,100,18800 11:201,111,18528 12:152,93,19248 13:143,160,18848 14:138,208,19120 15:135,218,18744 16:170,93,19088 17:174,161,19536 18:174,208,19648 19:176,217,19000`
