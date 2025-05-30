#!/usr/bin/env python3

import re
import sys

def remove_console_logs(content):
    # Remove simple single-line console.log statements
    content = re.sub(r'\s*console\.log\([^)]*\);\s*\n', '', content)
    
    # Remove console.log statements that span multiple lines
    # This pattern looks for console.log( and finds the matching closing )
    def remove_multiline_console_log(match):
        return ''
    
    # More sophisticated multiline console.log removal
    lines = content.split('\n')
    cleaned_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Check if this line starts a console.log statement
        if 'console.log(' in line:
            # Count parentheses to find the end of the statement
            paren_count = line.count('(') - line.count(')')
            full_statement = line
            
            # If parentheses don't balance, look for continuation lines
            while paren_count > 0 and i + 1 < len(lines):
                i += 1
                next_line = lines[i]
                full_statement += '\n' + next_line
                paren_count += next_line.count('(') - next_line.count(')')
            
            # Skip this entire console.log statement
            i += 1
            continue
        
        # Check if this line contains only parts of a console.log call (like forEach callback)
        elif re.match(r'\s*console\.log\(`.*\);\s*$', line):
            # Skip standalone console.log lines within forEach calls
            i += 1
            continue
        
        else:
            cleaned_lines.append(lines[i])
        
        i += 1
    
    return '\n'.join(cleaned_lines)

if __name__ == '__main__':
    file_path = '/Users/rkuykendall/Library/CloudStorage/Dropbox/Code/todo/backend/__tests__/integration/frequency.test.ts'
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    cleaned_content = remove_console_logs(content)
    
    with open(file_path, 'w') as f:
        f.write(cleaned_content)
    
    print("Console.log statements removed successfully!")
