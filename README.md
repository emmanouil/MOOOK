# MOOOK

---
## Branches
### master
Currently active master; contains experiments with extended AV streams

### kinect-audio
Inactive master; code used for *Streaming of Kinect Data for Interactive Audio Applications*

---

## Options
Options are set by defining a preprocessor variable macro with value 1 (i.e. `#define THIS_IS_ON 1`)  
  **NOTES:**  
To be sure that an option is deactivated use `#undef`  
Each option should be set/unset at its respective header file  
### Options in `Tools.h`  
- `USE_SERVICE` - Not implemented  
- `COORDS_TO_FILES` - Coordinates are writen in seperate files (otherwise in playlist file)  
- `ONE_SKEL_PER_FILE` - Each coordinate file consists of *one* coordinate set only [Requires `COORDS_TO_FILES` activated]

### Options in `Main.cpp`
All encoding options are set in variables inside `Main.cpp` __for now__
