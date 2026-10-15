# On-device test app for the firmware modules in ../main
cmake_minimum_required(VERSION 3.22)

set(COMPONENTS main)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(inkpost-firmware-test)
