#include "unity.h"

#include "ink_display.h"

// Runs after every test, even a failed one: the panel must never be left powered
// (Waveshare: a panel kept in its high-voltage state can be damaged for good).
void tearDown(void)
{
    ink_display_deinit();
}

void app_main(void)
{
    unity_run_menu();
}
