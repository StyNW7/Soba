cmake_minimum_required(VERSION 3.16)
project(soba_host_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(soba_host_tests
    test_logic.cpp
    ../main/protocol/event_codec.cpp
    ../main/protocol/frame_codec.cpp
    ../main/protocol/session_machine.cpp
    ../main/protocol/state_machine.cpp
    ../main/controls.cpp
)
target_include_directories(soba_host_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ../main
    ../main/include
    ../main/protocol
)
target_compile_options(soba_host_tests PRIVATE -Wall -Wextra -Werror)

enable_testing()
add_test(NAME soba_host_tests COMMAND soba_host_tests)
